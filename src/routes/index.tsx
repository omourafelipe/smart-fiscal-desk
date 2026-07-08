import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, Brush,
} from "recharts";
import {
  Upload, Loader2, FileText, Building2, AlertCircle, CloudUpload,
  TrendingUp, DollarSign, Percent, ShieldCheck, Users,
  Calculator, Sparkles, Download, X, Eye, FileSpreadsheet, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { importFiles, type ImportProgress } from "@/lib/fiscal/pipeline";
import { useFiscalStore } from "@/store/useFiscalStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DrillDownModal } from "@/components/DrillDownModal";
import { ExportMenu } from "@/components/ExportMenu";
import { PresentationMode } from "@/components/PresentationMode";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

/* ─── Formatters ─────────────────────────────────────────────── */

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

const NOME_MES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const MESES = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

/* ─── Color Palette ──────────────────────────────────────────── */
const C = {
  blue:    "#2563EB", // Faturamento Bruto
  green:   "#10B981", // Valor Líquido
  orange:  "#F97316", // Tributos Retidos
  purple:  "#7C3AED", // Categorias
  secondary:"#64748B", // Secundárias
  muted:   "#94A3B8",
};

const PALETA = [C.blue, C.green, C.orange, C.purple, "#06B6D4", "#EC4899", "#8B5CF6"];

/* ─── Empty State ────────────────────────────────────────────── */
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center bg-card border border-border rounded-2xl shadow-sm">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
        <DollarSign className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">Nenhum documento fiscal importado</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Faça a importação dos arquivos XML das NFS-e para alimentar os relatórios de faturamento e impostos retidos.
        </p>
      </div>
      <Button
        id="empty-state-upload-btn"
        onClick={onUpload}
        className="gap-2 h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-xl"
      >
        <CloudUpload className="h-4 w-4" />
        Importar NFS-e
      </Button>
    </div>
  );
}

/* ─── Custom Tooltips ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-md text-xs font-sans border-slate-200">
      {label && <div className="font-semibold text-foreground mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-semibold text-foreground">
            {formatter ? formatter(p.value, p.name) : fmtBRL(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Reusable Redesigned Chart Card Wrapper ──────────────────── */
function DashboardChartCard({
  title,
  subtitle,
  onExportPng,
  onExportCsv,
  onToggleFullScreen,
  children,
}: {
  title: string;
  subtitle?: string;
  onExportPng?: () => void;
  onExportCsv?: () => void;
  onToggleFullScreen?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="exec-card group bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-transform duration-200 hover:scale-[1.01]">
      <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="p-1 rounded hover:bg-muted text-slate-400 hover:text-slate-600 transition-colors"
              title="Exportar CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </button>
          )}
          {onExportPng && (
            <button
              onClick={onExportPng}
              className="p-1 rounded hover:bg-muted text-slate-400 hover:text-slate-600 transition-colors"
              title="Exportar PNG"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-1 rounded hover:bg-muted text-slate-400 hover:text-slate-600 transition-colors"
              title="Tela Cheia"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────── */
function Dashboard() {
  const {
    mesFiltro, setMesFiltro,
    anoFiltro, setAnoFiltro,
    emissaoMesFiltro,
    emissaoAnoFiltro,
    empresaFiltro, setEmpresaFiltro,
    statusFiltro, setStatusFiltro,
    operacaoFiltro,
    clienteFiltro, setClienteFiltro,
    municipioFiltro, setMunicipioFiltro,
    codigoTributarioFiltro,
    tipoServicoFiltro, setTipoServicoFiltro,
    categoriaFiltro, setCategoriaFiltro,
    resetFilters,
    drillDown,
    openDrillDown,
    closeDrillDown,
    presentationMode, setPresentationMode,
  } = useFiscalStore();

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Full Screen Chart state
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const empresas = useLiveQuery(() => db.empresas.toArray(), []);

  const semClassificacaoCount = useMemo(() => {
    return (docs ?? []).filter((d) => d.status_manual === "Ativo" && (!d.tipo_servico || d.tipo_servico === "Outros Serviços")).length;
  }, [docs]);

  const cnpjGrupoSet = useMemo(
    () => new Set((empresas ?? []).map((e) => e.cnpj)),
    [empresas]
  );

  const cnpjNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (empresas ?? []).forEach((e) => {
      if (e.cnpj && e.razao_social) m[e.cnpj] = e.razao_social;
    });
    return m;
  }, [empresas]);

  /* ─── Extract Unique Options for Filter Bar ─────────────────────── */
  const filterOptions = useMemo(() => {
    const list = docs ?? [];
    const anos = new Set<string>();
    const clientes = new Set<string>();
    const categorias = new Set<string>();
    const tipos = new Set<string>();
    const municipios = new Set<string>();

    list.forEach((d) => {
      if (d.data_competencia) anos.add(d.data_competencia.slice(0, 4));
      const cName = d.nome_tomador || d.cnpj_tomador;
      if (cName) clientes.add(cName);
      const cat = d.categoria_sintetica || d.categoria;
      if (cat) categorias.add(cat);
      const t = d.tipo_servico || d.grupo;
      if (t) tipos.add(t);
      if (d.municipio) municipios.add(d.municipio);
    });

    return {
      anos: Array.from(anos).sort().reverse(),
      clientes: Array.from(clientes).sort(),
      categorias: Array.from(categorias).sort(),
      tipos: Array.from(tipos).sort(),
      municipios: Array.from(municipios).sort(),
    };
  }, [docs]);

  // Reactive filters application
  const filtrados = useMemo(() => {
    return (docs ?? []).filter((d) => {
      if (anoFiltro && d.data_competencia?.slice(0, 4) !== anoFiltro) return false;
      if (mesFiltro && d.data_competencia?.split("-")[1] !== mesFiltro) return false;
      if (emissaoAnoFiltro && d.data_emissao?.slice(0, 4) !== emissaoAnoFiltro) return false;
      if (emissaoMesFiltro && d.data_emissao?.split("-")[1] !== emissaoMesFiltro) return false;
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;
      
      const isIC = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIC) return false;
      if (operacaoFiltro === "Externas" && isIC) return false;

      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return false;
      if (municipioFiltro && d.municipio !== municipioFiltro) return false;
      
      if (categoriaFiltro && (d.categoria_sintetica || d.categoria) !== categoriaFiltro) return false;
      if (tipoServicoFiltro && (d.tipo_servico || d.grupo) !== tipoServicoFiltro) return false;
      if (codigoTributarioFiltro && (d.item_lista_servico || d.codigo_servico) !== codigoTributarioFiltro) return false;

      return true;
    });
  }, [docs, anoFiltro, mesFiltro, emissaoAnoFiltro, emissaoMesFiltro, empresaFiltro, statusFiltro, operacaoFiltro, clienteFiltro, municipioFiltro, categoriaFiltro, tipoServicoFiltro, codigoTributarioFiltro, cnpjGrupoSet]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      anoFiltro || mesFiltro || empresaFiltro || clienteFiltro ||
      categoriaFiltro || tipoServicoFiltro || municipioFiltro
    );
  }, [anoFiltro, mesFiltro, empresaFiltro, clienteFiltro, categoriaFiltro, tipoServicoFiltro, municipioFiltro]);

  // Overall totals for dashboard display
  const totals = useMemo(() => {
    const bruto = filtrados.reduce((s, d) => s + d.valor_bruto, 0);
    const totalRetidos = filtrados.reduce((s, d) => s + (d.valor_retido || 0), 0);
    const liquido = bruto - totalRetidos;
    const qtd = filtrados.length;
    const ticket = qtd > 0 ? bruto / qtd : 0;

    const uniqueServices = new Set<string>();
    filtrados.forEach((d) => {
      if (d.tipo_servico) uniqueServices.add(d.tipo_servico);
    });
    const avgPerService = uniqueServices.size > 0 ? bruto / uniqueServices.size : 0;

    // Retenções individuais
    const issRetido = filtrados.reduce((s, d) => s + (d.vlr_iss_ret || 0), 0);
    const irrf = filtrados.reduce((s, d) => s + (d.vlr_irrf || 0), 0);
    const csll = filtrados.reduce((s, d) => s + (d.vlr_csll || 0), 0);
    const pis = filtrados.reduce((s, d) => s + (d.vlr_pis || 0), 0);
    const cofinanciar = filtrados.reduce((s, d) => s + (d.vlr_cofins || 0), 0);
    const percentRetido = bruto > 0 ? (totalRetidos / bruto) * 100 : 0;

    return {
      bruto,
      liquido,
      qtd,
      ticket,
      avgPerService,
      uniqueServicesCount: uniqueServices.size,
      issRetido,
      irrf,
      csll,
      pis,
      cofins: cofinanciar,
      totalRetidos,
      percentRetido,
    };
  }, [filtrados]);

  // Period comparison calculations (PoP Comparison)
  const periodComparison = useMemo(() => {
    if (!mounted || !docs || docs.length === 0) return null;

    let curYear = anoFiltro || emissaoAnoFiltro;
    let curMonth = mesFiltro || emissaoMesFiltro;

    if (!curYear) {
      let latest = "";
      docs.forEach(d => {
        if (d.data_competencia && d.data_competencia > latest) {
          latest = d.data_competencia;
        }
      });
      if (latest) {
        curYear = latest.slice(0, 4);
        curMonth = latest.split("-")[1];
      } else {
        curYear = new Date().getFullYear().toString();
        curMonth = String(new Date().getMonth() + 1).padStart(2, "0");
      }
    }

    let prevYear = "";
    let prevMonth = "";

    if (curMonth) {
      const m = parseInt(curMonth, 10);
      const y = parseInt(curYear, 10);
      if (m === 1) {
        prevMonth = "12";
        prevYear = String(y - 1);
      } else {
        prevMonth = String(m - 1).padStart(2, "0");
        prevYear = String(y);
      }
    } else {
      prevYear = String(parseInt(curYear, 10) - 1);
      prevMonth = "";
    }

    const filterPeriodDocs = (year: string, month: string) => {
      return (docs ?? []).filter((d) => {
        if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;
        const dateStr = d.data_competencia;
        if (!dateStr) return false;
        const [y, m] = dateStr.split("-");
        if (y !== year) return false;
        if (month && m !== month) return false;
        if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
        return true;
      });
    };

    const curDocs = filterPeriodDocs(curYear, curMonth);
    const prevDocs = filterPeriodDocs(prevYear, prevMonth);

    const calcStats = (arr: typeof docs) => {
      const bruto = arr.reduce((s, d) => s + d.valor_bruto, 0);
      const retidos = arr.reduce((s, d) => s + (d.valor_retido || 0), 0);
      const liquido = bruto - retidos;
      const count = arr.length;
      const ticket = count > 0 ? bruto / count : 0;
      const pctRetencao = bruto > 0 ? (retidos / bruto) * 100 : 0;

      const prestadores = new Set<string>();
      const tomadores = new Set<string>();
      arr.forEach(d => {
        if (d.cnpj_prestador) prestadores.add(d.cnpj_prestador);
        const c = d.nome_tomador || d.cnpj_tomador;
        if (c) tomadores.add(c);
      });

      return { bruto, liquido, count, ticket, retidos, pctRetencao, empresas: prestadores.size, clientes: tomadores.size };
    };

    const curStats = calcStats(curDocs);
    const prevStats = calcStats(prevDocs);

    const calcPctDiff = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const comparisonLabel = curMonth
      ? `${NOME_MES[curMonth]}/${curYear.slice(2)} vs ${NOME_MES[prevMonth]}/${prevYear.slice(2)}`
      : `${curYear} vs ${prevYear}`;

    return {
      label: comparisonLabel,
      cur: curStats,
      prev: prevStats,
      brutoPct: calcPctDiff(curStats.bruto, prevStats.bruto),
      liquidoPct: calcPctDiff(curStats.liquido, prevStats.liquido),
      countPct: calcPctDiff(curStats.count, prevStats.count),
      ticketPct: calcPctDiff(curStats.ticket, prevStats.ticket),
      retidosPct: calcPctDiff(curStats.retidos, prevStats.retidos),
      pctRetencaoDiff: curStats.pctRetencao - prevStats.pctRetencao,
      empresasPct: calcPctDiff(curStats.empresas, prevStats.empresas),
      clientesPct: calcPctDiff(curStats.clientes, prevStats.clientes),
    };
  }, [mounted, docs, anoFiltro, mesFiltro, emissaoAnoFiltro, emissaoMesFiltro, statusFiltro, empresaFiltro]);

  // 1. Evolução Mensal da Receita
  const evolutionData = useMemo(() => {
    let anchorYm = "";
    (docs ?? []).forEach(d => {
      if (d.data_competencia && d.data_competencia.slice(0, 7) > anchorYm) {
        anchorYm = d.data_competencia.slice(0, 7);
      }
    });
    if (!anchorYm) anchorYm = new Date().toISOString().slice(0, 7);
    const [anchorY, anchorM] = anchorYm.split("-").map(Number);

    const labels: { ym: string; ymPrev: string; name: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = anchorM - i;
      let y = anchorY;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const ymKey = `${y}-${String(m).padStart(2, "0")}`;
      const ymPrevKey = `${y - 1}-${String(m).padStart(2, "0")}`;
      labels.push({
        ym: ymKey,
        ymPrev: ymPrevKey,
        name: `${NOME_MES[String(m).padStart(2, "0")]}/${String(y).slice(2)}`
      });
    }

    const mapCur: Record<string, { bruto: number; liquido: number; retido: number }> = {};
    const mapPrev: Record<string, number> = {};
    labels.forEach(l => {
      mapCur[l.ym] = { bruto: 0, liquido: 0, retido: 0 };
      mapPrev[l.ymPrev] = 0;
    });

    (docs ?? []).forEach(d => {
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return;
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return;
      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return;
      if (categoriaFiltro && (d.categoria_sintetica || d.categoria) !== categoriaFiltro) return;

      const ym = d.data_competencia?.slice(0, 7);
      if (ym) {
        if (mapCur[ym]) {
          mapCur[ym].bruto += d.valor_bruto;
          mapCur[ym].liquido += d.valor_liquido;
          mapCur[ym].retido += d.valor_retido;
        }
        if (mapPrev[ym] !== undefined) {
          mapPrev[ym] += d.valor_bruto;
        }
      }
    });

    const baseList = labels.map(l => ({
      name: l.name,
      bruto: mapCur[l.ym].bruto,
      liquido: mapCur[l.ym].liquido,
      retido: mapCur[l.ym].retido,
      brutoAnterior: mapPrev[l.ymPrev] || 0,
      qtd: 0,
    }));

    (docs ?? []).forEach(d => {
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return;
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return;
      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return;

      const ym = d.data_competencia?.slice(0, 7);
      if (ym) {
        const labelIdx = labels.findIndex(lbl => lbl.ym === ym);
        if (labelIdx !== -1) {
          baseList[labelIdx].qtd += 1;
        }
      }
    });

    return baseList.map((d, i) => {
      let mediaMovel = d.bruto;
      if (i >= 2) {
        mediaMovel = (baseList[i].bruto + baseList[i - 1].bruto + baseList[i - 2].bruto) / 3;
      }
      return {
        ...d,
        mediaMovel,
      };
    });
  }, [docs, statusFiltro, empresaFiltro, clienteFiltro, categoriaFiltro]);

  // 2. Faturamento por Categoria Sintética
  const categoriesDistribution = useMemo(() => {
    const map: Record<string, { value: number; count: number; retido: number }> = {};
    filtrados.forEach((d) => {
      const cat = d.categoria_sintetica || "Outros Serviços";
      if (!map[cat]) map[cat] = { value: 0, count: 0, retido: 0 };
      map[cat].value += d.valor_bruto;
      map[cat].count += 1;
      map[cat].retido += d.valor_retido;
    });

    const list = Object.entries(map).map(([name, data]) => ({
      name,
      value: data.value,
      count: data.count,
      retido: data.retido,
    })).sort((a, b) => b.value - a.value);

    return list.map((item, idx) => ({
      ...item,
      color: PALETA[idx % PALETA.length],
      pct: totals.bruto > 0 ? (item.value / totals.bruto) * 100 : 0,
    }));
  }, [filtrados, totals.bruto]);

  // 3. Faturamento por Empresa
  const rankingEmpresas = useMemo(() => {
    const map: Record<string, { name: string; faturamento: number; retido: number; qtd: number; cnpj: string }> = {};
    filtrados.forEach((d) => {
      const key = d.cnpj_prestador || "00000000000000";
      if (!map[key]) {
        map[key] = { name: d.empresa_nome || d.nome_prestador || key, faturamento: 0, retido: 0, qtd: 0, cnpj: key };
      }
      map[key].faturamento += d.valor_bruto;
      map[key].retido += d.valor_retido;
      map[key].qtd += 1;
    });
    return Object.values(map).sort((a, b) => b.faturamento - a.faturamento).slice(0, 10);
  }, [filtrados]);

  // 4. Ranking de Clientes (Tomadores)
  const rankingClientes = useMemo(() => {
    const map: Record<string, { name: string; value: number; cnpj: string }> = {};
    filtrados.forEach((d) => {
      const key = d.cnpj_tomador || "Desconhecido";
      if (!map[key]) {
        map[key] = { name: d.nome_tomador || fmtCnpj(key), value: 0, cnpj: key };
      }
      map[key].value += d.valor_bruto;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtrados]);

  // 5. Waterfall data
  const waterfallData = useMemo(() => {
    const bruto = totals.bruto;
    const iss = totals.issRetido;
    const irrf = totals.irrf;
    const csll = totals.csll;
    const pis = totals.pis;
    const cofins = totals.cofins;
    const liquido = totals.liquido;

    return [
      { name: "Faturamento Bruto", range: [0, bruto], display: bruto, fill: C.blue },
      { name: "ISS Retido", range: [bruto - iss, bruto], display: -iss, fill: C.orange },
      { name: "IRRF", range: [bruto - iss - irrf, bruto - iss], display: -irrf, fill: C.orange },
      { name: "CSLL", range: [bruto - iss - irrf - csll, bruto - iss - irrf], display: -csll, fill: C.orange },
      { name: "PIS", range: [bruto - iss - irrf - csll - pis, bruto - iss - irrf - csll], display: -pis, fill: C.orange },
      { name: "COFINS", range: [bruto - iss - irrf - csll - pis - cofins, bruto - iss - irrf - csll - pis], display: -cofins, fill: C.orange },
      { name: "Valor Líquido", range: [0, liquido], display: liquido, fill: C.green },
    ];
  }, [totals]);

  const WaterfallTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-md text-xs font-sans">
        <div className="font-semibold text-slate-800">{data.name}</div>
        <div className="font-bold text-slate-900 mt-1">{fmtBRL(Math.abs(data.display))}</div>
      </div>
    );
  };

  /* ─── Export Series PNG/CSV Functions ───────────────────────────── */
  const exportPng = (chartId: string, title: string) => {
    const container = document.getElementById(chartId);
    const svg = container?.querySelector("svg");
    if (!svg) {
      toast.error("Componente gráfico não localizado para exportação.");
      return;
    }
    try {
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svg.clientWidth || 800;
        canvas.height = svg.clientHeight || 450;
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          const png = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = png;
          downloadLink.download = `${title.toLowerCase().replace(/\s+/g, "_")}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          toast.success(`Gráfico ${title} exportado em PNG!`);
        }
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (e: any) {
      toast.error(`Falha ao exportar PNG: ${e?.message || "desconhecido"}`);
    }
  };

  const exportEvolutionCsv = () => {
    const headers = ["Mes/Ano", "Ano Atual", "Ano Anterior", "Media Movel (3m)"];
    const rows = evolutionData.map((d) => [
      d.name,
      d.bruto.toFixed(2),
      d.brutoAnterior.toFixed(2),
      d.mediaMovel.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "evolucao_faturamento.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Evolução baixada em CSV!");
  };

  const exportDonutCsv = () => {
    const headers = ["Categoria", "Valor Faturado (R$)", "Notas", "Participacao (%)"];
    const rows = categoriesDistribution.map((d) => [
      `"${d.name}"`,
      d.value.toFixed(2),
      d.count,
      d.pct.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "participacao_categorias.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Categorias baixadas em CSV!");
  };

  const exportCompaniesCsv = () => {
    const headers = ["Empresa", "CNPJ", "Faturamento Bruto (R$)", "Tributos Retidos (R$)", "Notas"];
    const rows = rankingEmpresas.map((d) => [
      `"${d.name}"`,
      d.cnpj,
      d.faturamento.toFixed(2),
      d.retido.toFixed(2),
      d.qtd
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "faturamento_empresas.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Dados de empresas baixados em CSV!");
  };

  const exportWaterfallCsv = () => {
    const headers = ["Etapa", "Valor (R$)"];
    const rows = waterfallData.map((d) => [
      d.name,
      Math.abs(d.display).toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "decomposicao_faturamento.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Waterfall exportado em CSV!");
  };

  // Seeding/Import function
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".zip") || n.endsWith(".xml");
    });
    if (!arr.length) {
      toast.error("Envie arquivos .xml ou .zip contendo NFS-e.");
      return;
    }
    setImporting(true);
    setProgress({ done: 0, total: 0 });
    try {
      const summary = await importFiles(arr, setProgress);
      toast.success(
        `Importação concluída: ${summary.importadas} importadas, ${summary.duplicadas} duplicadas, ${summary.erros} erros.`
      );
    } catch (e: any) {
      toast.error(`Erro inesperado: ${e?.message ?? "desconhecido"}`);
    } finally {
      setImporting(false);
    }
  }, []);

  const hasData = (docs ?? []).length > 0;
  const isLoading = !mounted || docs === undefined;
  const mesSelecionado = MESES.find((m) => m.v === mesFiltro);
  const periodoLabel = [mesSelecionado?.l, anoFiltro].filter(Boolean).join(" ") || "Consolidado";

  // Recharts styling tokens
  const axTick = { fontSize: 10, fill: "#94a3b8" };
  const axGrid = "rgba(0,0,0,0.05)";

  return (
    <div className={`min-h-screen ${presentationMode ? "p-4 bg-slate-950 text-white" : "p-6 bg-background space-y-8 max-w-[1500px] mx-auto pb-16"}`}>
      {presentationMode && (
        <PresentationMode onExit={() => setPresentationMode(false)} />
      )}

      {/* Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Dashboard Executivo
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Cockpit inteligente de business intelligence consolidado para faturamento corporativo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasData && (
            <ExportMenu
              docs={filtrados}
              cnpjGrupoSet={cnpjGrupoSet}
              filterLabels={{
                periodo: periodoLabel,
                empresa: empresaFiltro ? cnpjNameMap[empresaFiltro] || empresaFiltro : "Consolidado",
                status: statusFiltro,
                operacao: operacaoFiltro,
              }}
              kpis={{
                bruto: totals.bruto,
                liquido: totals.liquido,
                retido: totals.totalRetidos,
                intercompany: 0,
                qtd: totals.qtd,
                ticketMedio: totals.ticket,
              }}
            />
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresentationMode(!presentationMode)}
            className="h-9 text-xs font-semibold rounded-xl"
          >
            Modo Apresentação
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xml"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) processFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />

          <Button
            onClick={() => inputRef.current?.click()}
            disabled={importing}
            size="sm"
            className="gap-1.5 h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-xl"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar NFS-e
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {semClassificacaoCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-800">Serviços Sem Classificação Gerencial</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Existem <strong>{semClassificacaoCount}</strong> notas fiscais associadas a "Outros Serviços" que requerem configuração na tabela de regras.
              </div>
            </div>
          </div>
          <Link
            to="/classificacao"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors border-0"
          >
            Configurar Regras
          </Link>
        </div>
      )}

      {/* Superior Fixed Filter Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Select Empresa */}
          <select
            value={empresaFiltro || "todos"}
            onChange={(e) => setEmpresaFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm w-[150px]"
          >
            <option value="todos">Empresas: Todas</option>
            {empresas?.map((g) => (
              <option key={g.cnpj} value={g.cnpj}>{g.razao_social || g.cnpj}</option>
            ))}
          </select>

          {/* Select Competência Ano */}
          <select
            value={anoFiltro || "todos"}
            onChange={(e) => setAnoFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="todos">Competência: Anos</option>
            {filterOptions.anos.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Select Competência Mês */}
          <select
            value={mesFiltro || "todos"}
            onChange={(e) => setMesFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="todos">Competência: Meses</option>
            {MESES.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>

          {/* Select Cliente */}
          <select
            value={clienteFiltro || "todos"}
            onChange={(e) => setClienteFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm w-[160px]"
          >
            <option value="todos">Clientes: Todos</option>
            {filterOptions.clientes.map((c) => (
              <option key={c} value={c}>{c.length > 20 ? c.slice(0, 20) + "..." : c}</option>
            ))}
          </select>

          {/* Select Categoria */}
          <select
            value={categoriaFiltro || "todos"}
            onChange={(e) => setCategoriaFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm w-[150px]"
          >
            <option value="todos">Categorias: Todas</option>
            {filterOptions.categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Select Tipo de Serviço */}
          <select
            value={tipoServicoFiltro || "todos"}
            onChange={(e) => setTipoServicoFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm w-[140px]"
          >
            <option value="todos">Tipos: Todos</option>
            {filterOptions.tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Select Município */}
          <select
            value={municipioFiltro || "todos"}
            onChange={(e) => setMunicipioFiltro(e.target.value === "todos" ? "" : e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 py-0.5 text-xs focus:ring-1 focus:ring-primary shadow-sm w-[140px]"
          >
            <option value="todos">Cidades: Todas</option>
            {filterOptions.municipios.map((mun) => (
              <option key={mun} value={mun}>{mun}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-700"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Drag & Drop Upload trigger */}
      {(importing || !hasData) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center bg-card/50 transition-all ${dragOver ? "border-primary bg-primary/5" : ""}`}
        >
          {importing ? (
            <div className="w-full max-w-md text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium">Processando arquivos XML...</p>
              {progress && (
                <div className="space-y-1.5">
                  <div className="h-2 bg-muted rounded-full overflow-hidden w-full">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{progress.done} de {progress.total}</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyState onUpload={() => inputRef.current?.click()} />
          )}
        </div>
      )}

      {hasData && !isLoading && (
        <div className="space-y-8">

          {/* ────────────────────────────────────────────────────────────────
              LINHA 1: KPIs PREMIUM (Altura máx. 100px)
              ──────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              {
                title: "Faturamento Bruto",
                value: fmtBRL(periodComparison?.cur.bruto ?? totals.bruto),
                pct: periodComparison?.brutoPct,
                hint: "Total bruto faturado.",
                color: C.blue,
                link: "/fiscal",
              },
              {
                title: "Valor Líquido",
                value: fmtBRL(periodComparison?.cur.liquido ?? totals.liquido),
                pct: periodComparison?.liquidoPct,
                hint: "Faturamento bruto deduzido das retenções.",
                color: C.green,
                link: "/fiscal",
              },
              {
                title: "Tributos Retidos",
                value: fmtBRL(periodComparison?.cur.retidos ?? totals.totalRetidos),
                pct: periodComparison?.retidosPct,
                hint: "Total retido em impostos.",
                color: C.orange,
                link: "/tributario",
              },
              {
                title: "Quantidade NFS",
                value: (periodComparison?.cur.count ?? totals.qtd).toLocaleString("pt-BR"),
                pct: periodComparison?.countPct,
                hint: "Total de NFS-e emitidas.",
                color: C.purple,
                link: "/notas",
              },
              {
                title: "Ticket Médio",
                value: fmtBRL(periodComparison?.cur.ticket ?? totals.ticket),
                pct: periodComparison?.ticketPct,
                hint: "Faturamento dividido pelas notas.",
                color: C.secondary,
                link: "/notas",
              },
              {
                title: "Clientes",
                value: `${periodComparison?.cur.clientes ?? totals.uniqueServicesCount} Tomadores`,
                pct: periodComparison?.clientesPct,
                hint: "Clientes ativos no período.",
                color: C.secondary,
                link: "/clientes",
              },
              {
                title: "Empresas",
                value: `${periodComparison?.cur.empresas ?? empresas?.length ?? 0} Emissores`,
                pct: periodComparison?.empresasPct,
                hint: "Empresas do grupo emissoras.",
                color: C.secondary,
                link: "/empresas",
              },
            ].map((kpi, idx) => {
              const hasPct = kpi.pct !== undefined && !isNaN(kpi.pct);
              const isGrowth = (kpi.pct ?? 0) >= 0;
              return (
                <Link
                  key={idx}
                  to={kpi.link}
                  className="flex-1 snap-start bg-card border border-border/80 hover:border-slate-300 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between group max-h-[100px]"
                  title={kpi.hint}
                >
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[120px]">
                      {kpi.title}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: kpi.color }} />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg md:text-xl font-bold font-mono tracking-tight text-slate-800">
                      {kpi.value}
                    </span>
                    {hasPct && (
                      <span className={`text-[10px] font-bold flex items-center shrink-0 ml-1.5 ${isGrowth ? "text-emerald-600" : "text-rose-600"}`}>
                        {isGrowth ? "+" : ""}{kpi.pct?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ────────────────────────────────────────────────────────────────
              LINHA 2: 70% EVOLUÇÃO (LINHA) vs 30% PARTICIPAÇÃO (DONUT)
              ──────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            
            {/* Gráfico 1: Evolução do Faturamento (70% - lg:col-span-7) */}
            <div id="chart-evolucao-container" className="lg:col-span-7">
              <DashboardChartCard
                title="Evolução Mensal do Faturamento"
                subtitle="Faturamento corrente vs ano anterior e média móvel consolidada de 3 meses"
                onExportCsv={exportEvolutionCsv}
                onExportPng={() => exportPng("chart-evolucao-container", "Evolução do Faturamento")}
                onToggleFullScreen={() => setExpandedChart("evolucao")}
              >
                <div className="h-[220px] w-full mt-2 font-mono text-[9px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                      <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={axTick} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
                      <Line type="monotone" dataKey="bruto" name="Bruto (Ano Corrente)" stroke={C.blue} strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="brutoAnterior" name="Bruto (Ano Anterior)" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="mediaMovel" name="Média Móvel (3m)" stroke={C.purple} strokeWidth={1.5} dot={false} />
                      <Brush dataKey="name" height={18} stroke={C.blue} fill="transparent" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DashboardChartCard>
            </div>

            {/* Gráfico 2: Participação das Categorias (30% - lg:col-span-3) */}
            <div id="chart-donut-container" className="lg:col-span-3">
              <DashboardChartCard
                title="Participação por Categoria"
                subtitle="Divisão percentual das receitas"
                onExportCsv={exportDonutCsv}
                onExportPng={() => exportPng("chart-donut-container", "Participação de Categorias")}
                onToggleFullScreen={() => setExpandedChart("donut")}
              >
                <div className="flex items-center justify-between gap-4 w-full h-[220px] pr-2">
                  {/* Donut slice */}
                  <div className="relative w-[130px] h-[130px] flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoriesDistribution}
                          innerRadius={45}
                          outerRadius={60}
                          paddingAngle={2.5}
                          dataKey="value"
                          onClick={(entry) => openDrillDown({ title: `NFS-e - Categoria: ${entry.name}`, filter: { type: "categoria_sintetica", value: entry.name } })}
                        >
                          {categoriesDistribution.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Total</span>
                      <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">{fmtBRLCompact(totals.bruto)}</span>
                    </div>
                  </div>

                  {/* Legend side */}
                  <div className="flex-1 flex flex-col justify-center space-y-1.5 overflow-y-auto max-h-[200px] pl-2 border-l border-border/40">
                    {categoriesDistribution.slice(0, 4).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                        <span className="flex items-center gap-1.5 truncate max-w-[90px]" title={entry.name}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                        <span className="font-mono text-slate-800 shrink-0">{entry.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                    {categoriesDistribution.length > 4 && (
                      <span className="text-[10px] text-slate-400 italic pl-3">
                        +{categoriesDistribution.length - 4} categorias
                      </span>
                    )}
                  </div>
                </div>
              </DashboardChartCard>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────────
              LINHA 3: 50% TOP CLIENTES vs 50% TOP CATEGORIAS (TABELAS)
              ──────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tabela Top Clientes */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-transform duration-200 hover:scale-[1.01]">
              <div className="border-b border-border/40 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Top Clientes tomadores</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ranking dos 5 maiores parceiros comerciais</p>
                </div>
                <Badge variant="secondary" className="px-2 py-0.5 text-[9px] rounded-lg font-bold">Consolidado</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 h-8">Cliente / Tomador</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-right h-8">Valor Faturado</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-center h-8">Part. %</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-center h-8">Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingClientes.slice(0, 5).map((c, idx) => {
                      const clientNotes = filtrados.filter(d => d.cnpj_tomador === c.cnpj || d.nome_tomador === c.name);
                      const count = clientNotes.length;
                      const pct = totals.bruto > 0 ? (c.value / totals.bruto) * 100 : 0;
                      return (
                        <TableRow
                          key={idx}
                          className="hover:bg-muted/10 cursor-pointer h-10 border-b border-border/40"
                          onClick={() => openDrillDown({ title: `NFS-e - Cliente: ${c.name}`, filter: { type: "cliente", value: c.name, cnpj: c.cnpj } })}
                        >
                          <TableCell className="font-semibold text-xs text-slate-700 truncate max-w-[160px] py-2" title={c.name}>
                            {c.name}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-xs py-2">{fmtBRL(c.value)}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-500 py-2">{pct.toFixed(1)}%</TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-400 py-2">{count}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Tabela Top Categorias */}
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-transform duration-200 hover:scale-[1.01]">
              <div className="border-b border-border/40 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Top Categorias de Serviço</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Ranking por categoria sintética de NFS-e</p>
                </div>
                <Badge variant="secondary" className="px-2 py-0.5 text-[9px] rounded-lg font-bold">Classificado</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 h-8">Categoria</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-right h-8">Valor Faturado</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-center h-8">Part. %</TableHead>
                      <TableHead className="font-bold text-[9px] uppercase text-slate-400 text-center h-8">Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesDistribution.slice(0, 5).map((cat, idx) => (
                      <TableRow
                        key={idx}
                        className="hover:bg-muted/10 cursor-pointer h-10 border-b border-border/40"
                        onClick={() => openDrillDown({ title: `NFS-e - Categoria: ${cat.name}`, filter: { type: "categoria_sintetica", value: cat.name } })}
                      >
                        <TableCell className="font-semibold text-xs text-slate-700 truncate max-w-[160px] py-2" title={cat.name}>
                          {cat.name}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-xs py-2">{fmtBRL(cat.value)}</TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-500 py-2">{cat.pct.toFixed(1)}%</TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-400 py-2">{cat.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────────
              LINHA 4: 50% FATURAMENTO POR EMPRESA vs 50% TRIBUTOS RETIDOS
              ──────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Gráfico 3: Faturamento por Empresa (Col: 50%) */}
            <div id="chart-empresas-container">
              <DashboardChartCard
                title="Faturamento por Empresa"
                subtitle="Faturamento bruto por CNPJ emissor"
                onExportCsv={exportCompaniesCsv}
                onExportPng={() => exportPng("chart-empresas-container", "Faturamento por Empresa")}
                onToggleFullScreen={() => setExpandedChart("empresas")}
              >
                <div className="h-[220px] w-full mt-2 font-mono text-[9px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingEmpresas} layout="vertical" margin={{ left: 20, right: 10, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={axGrid} horizontal={false} />
                      <XAxis type="number" tick={axTick} tickFormatter={(v) => fmtBRLCompact(v)} />
                      <YAxis type="category" dataKey="name" tick={axTick} width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="faturamento" name="Faturamento Bruto" fill={C.blue} radius={[0, 4, 4, 0]} onClick={(data) => openDrillDown({ title: `NFS-e - Empresa: ${data.name}`, filter: { type: "prestador", cnpj: data.cnpj } })} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashboardChartCard>
            </div>

            {/* Gráfico 4: Tributos Retidos por Empresa (Col: 50%) */}
            <div id="chart-tributos-container">
              <DashboardChartCard
                title="Tributos Retidos por Empresa"
                subtitle="Custos de retenção tributária consolidada por emissor"
                onExportCsv={exportCompaniesCsv} // utiliza mesma planilha de faturamentos/tributos
                onExportPng={() => exportPng("chart-tributos-container", "Tributos Retidos por Empresa")}
                onToggleFullScreen={() => setExpandedChart("tributos")}
              >
                <div className="h-[220px] w-full mt-2 font-mono text-[9px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingEmpresas} layout="vertical" margin={{ left: 20, right: 10, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={axGrid} horizontal={false} />
                      <XAxis type="number" tick={axTick} tickFormatter={(v) => fmtBRLCompact(v)} />
                      <YAxis type="category" dataKey="name" tick={axTick} width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="retido" name="Tributos Retidos" fill={C.orange} radius={[0, 4, 4, 0]} onClick={(data) => openDrillDown({ title: `NFS-e - Empresa: ${data.name}`, filter: { type: "prestador", cnpj: data.cnpj } })} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashboardChartCard>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────────
              LINHA 5: GRÁFICO CASCATA (WATERFALL) (LARGURA TOTAL 100%)
              ──────────────────────────────────────────────────────────────── */}
          <div id="chart-waterfall-container">
            <DashboardChartCard
              title="Waterfall do Faturamento Líquido"
              subtitle="Demonstrativo de deduções retidas na fonte (ISS, IRRF, CSLL, PIS, COFINS) do faturamento bruto ao líquido"
              onExportCsv={exportWaterfallCsv}
              onExportPng={() => exportPng("chart-waterfall-container", "Waterfall de Faturamento")}
              onToggleFullScreen={() => setExpandedChart("waterfall")}
            >
              <div className="h-[260px] w-full mt-2 font-mono text-[9px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                    <XAxis dataKey="name" tick={axTick} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={axTick} tickLine={false} />
                    <Tooltip content={<WaterfallTooltip />} />
                    <Bar dataKey="range" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.fill}
                          onClick={() => {
                            const mapping: Record<string, string> = {
                              "ISS Retido": "ISS Retido",
                              "IRRF": "IRRF",
                              "CSLL": "CSLL",
                              "PIS": "PIS",
                              "COFINS": "COFINS"
                            };
                            const filterVal = mapping[entry.name] || "Todos";
                            openDrillDown({
                              title: `NFS-e - Filtro Tributário: ${entry.name}`,
                              filter: { type: "tributo", value: filterVal }
                            });
                          }}
                          className="cursor-pointer"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardChartCard>
          </div>

        </div>
      )}

      {/* Drill Down Modal */}
      {drillDown && (
        <DrillDownModal
          title={drillDown.title}
          filter={drillDown.filter}
          filteredDocs={filtrados}
          cnpjGrupoSet={cnpjGrupoSet}
          onClose={closeDrillDown}
        />
      )}

      {/* Expanded Chart Overlay Modal */}
      {expandedChart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-4xl p-6 relative border border-border shadow-2xl animate-in fade-in duration-200">
            <button
              onClick={() => setExpandedChart(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-base font-bold text-slate-800 mb-4 border-b border-border/50 pb-2">
              Visualização Ampliada:{" "}
              {expandedChart === "evolucao" && "Evolução Mensal do Faturamento"}
              {expandedChart === "donut" && "Participação por Categoria"}
              {expandedChart === "empresas" && "Faturamento por Empresa"}
              {expandedChart === "tributos" && "Tributos Retidos por Empresa"}
              {expandedChart === "waterfall" && "Waterfall do Faturamento Líquido"}
            </h3>
            
            <div className="h-[400px] w-full flex items-center justify-center">
              {expandedChart === "evolucao" && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => fmtBRL(Number(v))} stroke="#94a3b8" />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="bruto" name="Bruto (Ano Corrente)" stroke={C.blue} strokeWidth={2.5} />
                    <Line type="monotone" dataKey="brutoAnterior" name="Bruto (Ano Anterior)" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="mediaMovel" name="Média Móvel (3m)" stroke={C.purple} strokeWidth={1.5} />
                    <Brush dataKey="name" height={20} stroke={C.blue} />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {expandedChart === "donut" && (
                <div className="flex items-center justify-center gap-12 w-full h-full max-w-2xl">
                  <div className="relative w-[220px] h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoriesDistribution}
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={2.5}
                          dataKey="value"
                        >
                          {categoriesDistribution.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs uppercase font-bold text-slate-400">Total</span>
                      <span className="text-base font-bold text-slate-800 font-mono mt-0.5">{fmtBRL(totals.bruto)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center space-y-2 max-h-[300px] overflow-y-auto pl-6 border-l border-border">
                    {categoriesDistribution.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-10 justify-between text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-2 truncate max-w-[150px]">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                        <span className="font-mono text-slate-800">{fmtBRL(entry.value)} ({entry.pct.toFixed(1)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expandedChart === "empresas" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingEmpresas} layout="vertical" margin={{ left: 40, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => fmtBRL(v)} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="faturamento" name="Faturamento Bruto" fill={C.blue} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {expandedChart === "tributos" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingEmpresas} layout="vertical" margin={{ left: 40, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => fmtBRL(v)} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="retido" name="Tributos Retidos" fill={C.orange} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {expandedChart === "waterfall" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis tickFormatter={(v) => fmtBRL(Number(v))} stroke="#94a3b8" />
                    <Tooltip content={<WaterfallTooltip />} />
                    <Bar dataKey="range" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
