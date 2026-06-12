import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import JSZip from "jszip";
import { z } from "zod";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { AlertCircle, FileSpreadsheet, Download, Upload, CheckCircle2, FileJson, X, Search, Filter, TrendingUp, DollarSign, Activity, Settings2, Trash2, Calendar, Building2, ShoppingBag, Loader2, FileText, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PermissionService } from "@/lib/services/PermissionService";
import { toast } from "sonner";
import { db, type NotaFiscalTomada, type ServiceClassification, type CategoryRule } from "@/lib/db";
import { parseNfseXmlTomada } from "@/lib/parseXml";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useTenantStore } from "@/store/useTenantStore";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { classificarServicoLocal, lc116CategoriasMap, lc116SubItemCategoriasMap, obterGrupoSintetico } from "@/lib/category-utils";

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/tomados")({
  validateSearch: searchSchema,
  component: TomadosRouteComponent,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (dataStr: string) => {
  if (!dataStr) return "—";
  try {
    const clean = dataStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
};

const formatarCnpjCpf = (val: string) => {
  const clean = String(val ?? "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return val;
};

const SERV_COLORS = [
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f97316", // Orange
  "#a855f7", // Purple
  "#84cc16", // Lime
  "#64748b"  // Slate (for Outras)
];

const PAGE_SIZE_TOMADAS = 20;

function TomadosRouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });

  const { addActivity } = useLayoutShell();
  const { activeRole } = useTenantStore();
  const canEdit = PermissionService.canEdit(activeRole);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Filters from URL Search Params
  const mesFiltroTomadas = search.mes || "__all__";
  const anoFiltroTomadas = search.ano || "__all__";
  const empresaFiltroTomadas = search.empresa || "__all__";

  // Local route states
  const [searchTomadas, setSearchTomadas] = useState("");
  const [pageTomadas, setPageTomadas] = useState(1);
  const [categoriaFiltroTomadas, setCategoriaFiltroTomadas] = useState<string | "__all__">("__all__");
  const [importingTomadas, setImportingTomadas] = useState(false);
  const [progressTomadas, setProgressTomadas] = useState<{ done: number; total: number } | null>(null);

  const fileRefTomadas = useRef<HTMLInputElement>(null);

  const setMesFiltroTomadas = (val: string) => {
    navigate({ search: (prev: any) => ({ ...prev, mes: val === "__all__" ? undefined : val }) });
    setPageTomadas(1);
  };
  const setAnoFiltroTomadas = (val: string) => {
    navigate({ search: (prev: any) => ({ ...prev, ano: val === "__all__" ? undefined : val }) });
    setPageTomadas(1);
  };
  const setEmpresaFiltroTomadas = (val: string) => {
    navigate({ search: (prev: any) => ({ ...prev, empresa: val === "__all__" ? undefined : val }) });
    setPageTomadas(1);
  };

  // ── Database query ──────────────────────────────────────────────
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], [] as NotaFiscalTomada[]);
  const classifications = useLiveQuery(() => db.serviceClassifications.toArray(), [], [] as ServiceClassification[]);
  const rules = useLiveQuery(() => db.categoryRules.toArray(), [], [] as CategoryRule[]);

  const classificationsMap = useMemo(() => {
    const map = new Map<string, ServiceClassification>();
    if (classifications) {
      classifications.forEach((c) => {
        if (c.codigo) map.set(c.codigo, c);
      });
    }
    return map;
  }, [classifications]);

  const categorizarComOverride = useCallback((servicoDesc: string, code?: string) => {
    if (!code) return "Sem categoria";
    // 1. Verifica se já existe classificação no banco local
    const existing = classificationsMap.get(code);
    if (existing && existing.categoriaExecutiva) {
      return existing.categoriaExecutiva;
    }
    // 2. Senão, roda a classificação automática (passando as regras manuais se existirem)
    const ruleList = rules || [];
    const res = classificarServicoLocal(code, servicoDesc, ruleList);
    return res.categoriaExecutiva || "Outros Serviços";
  }, [classificationsMap, rules]);

  // File processors
  const processFilesTomadas = useCallback(async (files: FileList) => {
    setImportingTomadas(true);
    setProgressTomadas(null);
    try {
      const zipFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".zip"));
      
      if (zipFiles.length === 0) {
        toast.error("Envie arquivos .zip contendo XMLs NFS-e de serviços tomados.");
        setImportingTomadas(false);
        return;
      }

      const existingNotas = await db.notas.toArray();
      const existingNotasTomadas = await db.notasTomadas.toArray();
      const cnpjsGrupo = new Set([
        ...existingNotas.map((n) => n.cnpjPrestador.replace(/\D/g, "")),
        ...existingNotasTomadas.map((n) => n.cnpjTomador.replace(/\D/g, ""))
      ].filter(Boolean));

      let totalXmls = 0;
      let doneXmls = 0;
      const batch: NotaFiscalTomada[] = [];

      for (const zipFile of zipFiles) {
        const buf = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const xmlEntries = Object.values(zip.files).filter(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".xml")
        );
        totalXmls += xmlEntries.length;

        for (const entry of xmlEntries) {
          const xml = await entry.async("string");
          const nota = parseNfseXmlTomada(xml, cnpjsGrupo);
          if (nota) batch.push(nota);
          doneXmls++;
          setProgressTomadas({ done: doneXmls, total: totalXmls });
        }
      }

      if (batch.length > 0) {
        await db.notasTomadas.bulkPut(batch);
        addActivity("upload", `${batch.length} Tomadas Importadas`, `Importação de serviços tomados finalizada.`);
        toast.success(`${batch.length} nota(s) de serviço tomado importada(s).`);
      } else {
        if (cnpjsGrupo.size > 0) {
          toast.warning("Nenhuma nota com CNPJ do grupo como tomador foi encontrada.");
        } else {
          toast.warning("Nenhuma nota fiscal de serviço tomado válida foi encontrada.");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao importar arquivos tomados.");
    } finally {
      setImportingTomadas(false);
      setProgressTomadas(null);
    }
  }, [addActivity]);

  const exportCsvTomadas = () => {
    const headers = [
      "Número NFS",
      "Situação",
      "Data Emissão",
      "Competência",
      "CNPJ Prestador",
      "Fornecedor",
      "Serviço",
      "Categoria",
      "Vlr. Bruto",
      "Vlr. Líquido",
      "Vlr. ISS",
      "ISS Retido?",
      "IRRF",
      "CSLL",
      "PIS",
      "COFINS",
      "INSS",
    ];
    const rows = notasTomValidas.map((n) => {
      const cat = categorizarComOverride(n.servico, n.codTribNacional);
      return [
        n.nNFSe,
        n.status === "válida" ? "Válida" : "Cancelada",
        formatarData(n.dhEmi),
        n.dCompet ? n.dCompet.slice(0, 7) : "—",
        formatarCnpjCpf(n.cnpjPrestador),
        n.nomePrestador,
        n.servico,
        cat || "Sem categoria",
        n.valor.toFixed(2),
        n.vlrLiquido.toFixed(2),
        (n.vlrIss ?? 0).toFixed(2),
        n.issRetido,
        n.vlrIrrf.toFixed(2),
        n.vlrCsll.toFixed(2),
        n.vlrPis.toFixed(2),
        n.vlrCofins.toFixed(2),
        n.vlrInss.toFixed(2),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tomadas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived data ─────────────────────────────────────────
  const notasTomValidasSemCategoria = useMemo(() => {
    return (todasNotasTomadas ?? []).filter((n) => {
      if (n.status !== "válida") return false;
      const ds = (n.dCompet || n.dhEmi || "").slice(0, 10);
      if (mesFiltroTomadas !== "__all__" && ds.slice(5, 7) !== mesFiltroTomadas) return false;
      if (anoFiltroTomadas !== "__all__" && ds.slice(0, 4) !== anoFiltroTomadas) return false;
      if (empresaFiltroTomadas !== "__all__" && n.cnpjTomador !== empresaFiltroTomadas) return false;
      if (searchTomadas) {
        const query = searchTomadas.toLowerCase().trim();
        const matchFornecedor = (n.nomePrestador || "").toLowerCase().includes(query);
        const matchNFS = (n.nNFSe || "").toLowerCase().includes(query);
        if (!matchFornecedor && !matchNFS) return false;
      }
      return true;
    });
  }, [todasNotasTomadas, mesFiltroTomadas, anoFiltroTomadas, empresaFiltroTomadas, searchTomadas]);

  const { servicoData, top12Keys } = useMemo(() => {
    const servicoMap = new Map<string, number>();
    notasTomValidasSemCategoria.forEach((n) => {
      const cat = categorizarComOverride(n.servico, n.codTribNacional) || "Sem categoria";
      const grupo = obterGrupoSintetico(cat);
      servicoMap.set(grupo, (servicoMap.get(grupo) ?? 0) + n.valor);
    });

    const servicoEntries = Array.from(servicoMap.entries()).sort(([, a], [, b]) => b - a);
    const topServicos = servicoEntries.slice(0, 12);
    const top12Keys = topServicos.map(([k]) => k);
    const outrosServ = servicoEntries.slice(12).reduce((s, [, v]) => s + v, 0);
    const servicoData = [
      ...topServicos.map(([k, v], i) => ({ name: k, value: v, fill: SERV_COLORS[i % 12] })),
      ...(outrosServ > 0 ? [{ name: "Outras", value: outrosServ, fill: SERV_COLORS[12] }] : [])
    ];

    return { servicoData, top12Keys };
  }, [notasTomValidasSemCategoria, categorizarComOverride]);

  const notasTomValidas = useMemo(() => {
    return notasTomValidasSemCategoria.filter((n) => {
      if (categoriaFiltroTomadas === "__all__") return true;
      const cat = categorizarComOverride(n.servico, n.codTribNacional) || "Sem categoria";
      const grupo = obterGrupoSintetico(cat);
      if (categoriaFiltroTomadas === "Outras") {
        return !top12Keys.includes(grupo);
      }
      return grupo === categoriaFiltroTomadas;
    });
  }, [notasTomValidasSemCategoria, categoriaFiltroTomadas, top12Keys, categorizarComOverride]);

  const totalTomados = useMemo(() => notasTomValidas.reduce((s, n) => s + n.valor, 0), [notasTomValidas]);
  const fornecedoresAtivos = useMemo(() => new Set(notasTomValidas.map((n) => n.cnpjPrestador)).size, [notasTomValidas]);
  const ticketMedioFornecedor = useMemo(() => fornecedoresAtivos > 0 ? totalTomados / fornecedoresAtivos : 0, [totalTomados, fornecedoresAtivos]);
  const issRetidoTomadaTotal = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.issRetido === "Sim" ? (Number(n.vlrIssRet) || 0) : 0), 0), [notasTomValidas]);
  const irrfTotal = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.vlrIrrf ?? 0), 0), [notasTomValidas]);
  const csllTotal = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.vlrCsll ?? 0), 0), [notasTomValidas]);
  const pisTotal  = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.vlrPis  ?? 0), 0), [notasTomValidas]);
  const cofinsTotal = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.vlrCofins ?? 0), 0), [notasTomValidas]);
  const inssTotal = useMemo(() => notasTomValidas.reduce((s, n) => s + (n.vlrInss ?? 0), 0), [notasTomValidas]);
  const totalRetencoes = useMemo(() => issRetidoTomadaTotal + irrfTotal + csllTotal + pisTotal + cofinsTotal + inssTotal, [issRetidoTomadaTotal, irrfTotal, csllTotal, pisTotal, cofinsTotal, inssTotal]);

  // Anos/meses disponíveis para filtros
  const anosDisp = useMemo(() => {
    return Array.from(new Set((todasNotasTomadas ?? []).map((n) => (n.dCompet || n.dhEmi || "").slice(0, 4)).filter(Boolean))).sort().reverse();
  }, [todasNotasTomadas]);

  const tomadoresDist = useMemo(() => {
    return Array.from(new Set((todasNotasTomadas ?? []).map((n) => n.cnpjTomador).filter(Boolean)));
  }, [todasNotasTomadas]);

  // Gráfico A — evolução mensal
  const evolucaoData = useMemo(() => {
    const evolucaoMap = new Map<string, number>();
    notasTomValidas.forEach((n) => {
      const key = (n.dCompet || n.dhEmi || "").slice(0, 7);
      if (key) evolucaoMap.set(key, (evolucaoMap.get(key) ?? 0) + n.valor);
    });
    return Array.from(evolucaoMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      label: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(k.slice(5,7))-1] + "/" + k.slice(2,4),
      valor: v,
    }));
  }, [notasTomValidas]);

  // Gráfico C — top 8 fornecedores
  const topFornecedores = useMemo(() => {
    const fornMap = new Map<string, { nome: string; total: number }>();
    notasTomValidas.forEach((n) => {
      const entry = fornMap.get(n.cnpjPrestador) ?? { nome: n.nomePrestador, total: 0 };
      fornMap.set(n.cnpjPrestador, { ...entry, total: entry.total + n.valor });
    });
    return Array.from(fornMap.values()).sort((a,b)=>b.total-a.total).slice(0,8);
  }, [notasTomValidas]);

  // Gráfico D — retenções mensais empilhadas
  const retData = useMemo(() => {
    const retMap = new Map<string, { ISS: number; IRRF: number; CSPN: number; INSS: number }>();
    notasTomValidas.forEach((n) => {
      const key = (n.dCompet || n.dhEmi || "").slice(0, 7);
      if (!key) return;
      const e = retMap.get(key) ?? { ISS: 0, IRRF: 0, CSPN: 0, INSS: 0 };
      retMap.set(key, {
        ISS:  e.ISS  + (n.issRetido === "Sim" ? (Number(n.vlrIssRet) || 0) : 0),
        IRRF: e.IRRF + (Number(n.vlrIrrf) || 0),
        CSPN: e.CSPN + (Number(n.vlrCsll) || 0) + (Number(n.vlrPis) || 0) + (Number(n.vlrCofins) || 0),
        INSS: e.INSS + (Number(n.vlrInss) || 0),
      });
    });
    return Array.from(retMap.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v]) => ({
      label: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(k.slice(5,7))-1] + "/" + k.slice(2,4),
      ...v,
    }));
  }, [notasTomValidas]);

  // Paginação tabela
  const totalPagesTomadas = Math.ceil(notasTomValidas.length / PAGE_SIZE_TOMADAS);
  const paginatedTomadas = useMemo(() => {
    return notasTomValidas.slice((pageTomadas - 1) * PAGE_SIZE_TOMADAS, pageTomadas * PAGE_SIZE_TOMADAS);
  }, [notasTomValidas, pageTomadas]);

  const nomeTomadorLabel = (cnpj: string) => {
    const n = (todasNotasTomadas ?? []).find((x) => x.cnpjTomador === cnpj);
    return n?.nomeTomador || cnpj;
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* Header + Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Serviços Tomados</h1>
          <p className="text-xs text-muted-foreground mt-1">NFS-e recebidas de fornecedores onde o grupo Samel é tomador · Obrigações de retenção na fonte</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Select value={empresaFiltroTomadas} onValueChange={setEmpresaFiltroTomadas}>
            <SelectTrigger className="w-[200px] h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
              <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Empresa Tomadora" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__">Todas as Tomadoras</SelectItem>
              {tomadoresDist.map((cnpj) => (
                <SelectItem key={cnpj} value={cnpj}>{nomeTomadorLabel(cnpj)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mesFiltroTomadas} onValueChange={setMesFiltroTomadas}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__">Todos os Meses</SelectItem>
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i)=>(
                <SelectItem key={m} value={m}>{["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][i]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoFiltroTomadas} onValueChange={setAnoFiltroTomadas}>
            <SelectTrigger className="w-[105px] h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__all__">Todos os Anos</SelectItem>
              {anosDisp.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <input
            ref={fileRefTomadas}
            type="file"
            accept=".zip"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFilesTomadas(e.target.files)}
          />
          {canEdit && (
            <Button
              disabled={importingTomadas}
              onClick={() => !importingTomadas && fileRefTomadas.current?.click()}
              className="flex items-center gap-2 px-4 h-9 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all duration-300 hover:scale-[1.01] cursor-pointer"
            >
              {importingTomadas ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressTomadas ? `Importando (${progressTomadas.done}/${progressTomadas.total})` : "Importando..."}
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Importar Tomadas (ZIP)
                </>
              )}
            </Button>
          )}
        </div>
      </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {([
          { label: "Total de Serviços Tomados", value: fmtBRL(totalTomados), sub: "valor bruto consolidado", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
          { label: "Fornecedores Ativos", value: fornecedoresAtivos.toLocaleString("pt-BR"), sub: "prestadores distintos no período", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Notas Recebidas", value: notasTomValidas.length.toLocaleString("pt-BR"), sub: "NFS-e válidas do período", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
          { label: "Ticket Médio / Fornecedor", value: fmtBRL(ticketMedioFornecedor), sub: "valor médio contratado por fornecedor", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "Total de Retenções", value: fmtBRL(totalRetencoes), sub: "obrigações de retenção na fonte", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
        ] as const).map((kpi, i) => {
          const isLong = kpi.value.length > 12;
          const isVeryLong = kpi.value.length > 16;
          const valueFontSize = isVeryLong
            ? "text-xs sm:text-sm font-bold tracking-tighter"
            : isLong
              ? "text-sm sm:text-base font-extrabold tracking-tighter"
              : "text-base sm:text-lg md:text-xl font-extrabold tracking-tight";

          return (
            <div key={i} className="p-4 sm:p-5 xl:p-4 2xl:p-5 rounded-2xl border bg-card flex flex-col justify-between shadow-xs border-border transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <p className={`${valueFontSize} text-foreground mt-1.5`}>{kpi.value}</p>
                </div>
                <div className={`h-8 w-8 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Painel de Retenções */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Obrigações de Retenção na Fonte</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {([
            { label: "ISS Retido", value: issRetidoTomadaTotal, hint: "Retido pelo tomador (Samel)", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
            { label: "IRRF", value: irrfTotal, hint: "Imposto de Renda Retido na Fonte", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
            { label: "CSLL", value: csllTotal, hint: "Contrib. Social s/ Lucro Líquido", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
            { label: "PIS", value: pisTotal, hint: "Prog. de Integração Social", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
            { label: "COFINS", value: cofinsTotal, hint: "Contrib. p/ Financiamento Seguridade", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "INSS/CPRB", value: inssTotal, hint: "Retenção previdenciária", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
          ] as const).map((item, i) => (
            <div key={i} className={`p-3 rounded-xl border border-border/50 ${item.bg} flex flex-col gap-1`}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className={`text-sm font-bold ${item.color}`}>{fmtBRL(item.value)}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos: Evolução + Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico A — Evolução mensal */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-foreground mb-1">Evolução dos Serviços Tomados</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Valor total mensal de NFS-e recebidas</p>
          <div className="h-[260px]">
            {evolucaoData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucaoData}>
                  <defs>
                    <linearGradient id="colorTomadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `R$ ${(v/1000000).toFixed(1)}M` : `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                  <Area type="monotone" dataKey="valor" stroke="#14b8a6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTomadas)" name="Serviços Tomados" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico B — Distribuição por tipo de serviço */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1">Por Tipo de Serviço</h3>
              <p className="text-[10px] text-muted-foreground mb-4">Distribuição por categoria de serviço</p>
            </div>
            {categoriaFiltroTomadas !== "__all__" && (
              <button
                onClick={() => {
                  setCategoriaFiltroTomadas("__all__");
                  setPageTomadas(1);
                }}
                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-350 cursor-pointer"
              >
                Limpar Filtro
              </button>
            )}
          </div>
          <div className="h-[260px] relative flex items-center justify-center">
            {servicoData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={servicoData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={1.5}
                    stroke="var(--color-card)"
                    strokeWidth={3}
                    onMouseEnter={(_, index) => setActivePieIndex(index)}
                    onMouseLeave={() => setActivePieIndex(null)}
                    onClick={(data) => {
                      if (data && data.name) {
                        const clickedName = data.name;
                        if (categoriaFiltroTomadas === clickedName) {
                          setCategoriaFiltroTomadas("__all__");
                        } else {
                          setCategoriaFiltroTomadas(clickedName);
                        }
                        setPageTomadas(1);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {servicoData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.fill}
                        opacity={activePieIndex === null || activePieIndex === i ? 1 : 0.6}
                        style={{
                          transform: activePieIndex === i ? 'scale(1.03)' : 'scale(1)',
                          transformOrigin: '50% 50%',
                          transition: 'transform 0.2s ease, opacity 0.2s ease',
                        }}
                        className="cursor-pointer outline-none focus:outline-none"
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => {
                      const totalVal = servicoData.reduce((acc, curr) => acc + curr.value, 0);
                      const pct = totalVal > 0 ? ((value / totalVal) * 100).toFixed(1) : "0.0";
                      return [`${fmtBRL(value)} (${pct}%)`, "Valor"];
                    }} 
                    contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="max-h-[160px] overflow-y-auto pr-1 mt-2 pt-2 border-t border-border/50 scrollbar-thin">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {servicoData.map((d, i) => {
                const isSelected = categoriaFiltroTomadas === d.name;
                const isHovered = activePieIndex === i;
                return (
                  <button
                    key={i}
                    onMouseEnter={() => setActivePieIndex(i)}
                    onMouseLeave={() => setActivePieIndex(null)}
                    onClick={() => {
                      if (isSelected) {
                        setCategoriaFiltroTomadas("__all__");
                      } else {
                        setCategoriaFiltroTomadas(d.name);
                      }
                      setPageTomadas(1);
                    }}
                    className={`flex items-center justify-between text-[10px] p-1 px-1.5 rounded-lg transition-all text-left cursor-pointer hover:bg-muted/80 w-full ${
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-500/25"
                        : isHovered
                          ? "bg-muted text-foreground"
                          : "border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[110px]" title={d.name}>
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-bold text-foreground flex-shrink-0 ml-1">{fmtBRL(d.value)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos: Top Fornecedores + Retenções Mensais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico C — Top Fornecedores */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-foreground mb-1">Top Fornecedores</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Maiores prestadores por volume contratado</p>
          <div className="h-[260px]">
            {topFornecedores.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFornecedores} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" stroke="var(--color-muted-foreground)" fontSize={9} axisLine={false} tickLine={false} width={110} tickFormatter={(v: string) => v.length > 18 ? v.slice(0,18)+"…" : v} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} name="Valor" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico D — Retenções mensais empilhadas */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-foreground mb-1">Retenções por Competência</h3>
          <p className="text-[10px] text-muted-foreground mb-4">ISS, IRRF, CSLL/PIS/COFINS e INSS empilhados</p>
          <div className="h-[260px]">
            {retData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ISS"  stackId="ret" fill="#6366f1" name="ISS" />
                  <Bar dataKey="IRRF" stackId="ret" fill="#f59e0b" name="IRRF" />
                  <Bar dataKey="CSPN" stackId="ret" fill="#14b8a6" name="CSLL/PIS/COFINS" />
                  <Bar dataKey="INSS" stackId="ret" fill="#ec4899" name="INSS" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Notas Tomadas */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              NFS-e Recebidas de Fornecedores ({notasTomValidas.length.toLocaleString("pt-BR")})
            </h3>
            {categoriaFiltroTomadas !== "__all__" && (
              <Badge variant="secondary" className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/20 transition-all font-semibold">
                Categoria: {categoriaFiltroTomadas}
                <button
                  onClick={() => {
                    setCategoriaFiltroTomadas("__all__");
                    setPageTomadas(1);
                  }}
                  className="hover:bg-indigo-500/30 rounded-full p-0.5 text-indigo-700 transition-colors cursor-pointer"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por fornecedor ou nº NFS..."
                value={searchTomadas}
                onChange={(e) => { setSearchTomadas(e.target.value); setPageTomadas(1); }}
                className="pl-8 h-8 rounded-lg text-xs bg-muted border-border hover:bg-muted/80 focus:bg-card placeholder:text-muted-foreground w-full"
              />
            </div>
            
            {(todasNotasTomadas?.length ?? 0) > 0 && (
              <>
                <button
                  onClick={exportCsvTomadas}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </button>
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (confirm("Limpar toda a base de notas tomadas?")) {
                        await db.notasTomadas.clear();
                        toast.success("Base de serviços tomados limpa.");
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar Base
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
             <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead className="font-medium text-muted-foreground h-9">Situação</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Nº NFS-e</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Emissão</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Competência</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">CNPJ Prestador</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Fornecedor</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Serviço / Categoria</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Bruto</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Líquido</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. ISS</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground h-9">ISS Retido?</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">IRRF</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">CSLL</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">PIS</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">COFINS</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">INSS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTomadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center text-muted-foreground py-12 text-xs">
                    {(todasNotasTomadas?.length ?? 0) === 0
                      ? "Nenhum serviço tomado importado. Use o botão \"Importar Tomadas (ZIP)\" no cabeçalho para começar."
                      : "Nenhum resultado para os filtros selecionados."}
                  </TableCell>
                </TableRow>
              ) : paginatedTomadas.map((n, i) => {
                const cat = categorizarComOverride(n.servico, n.codTribNacional);
                return (
                  <TableRow key={n.id} className={`border-b border-border/40 text-xs hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${n.status === "válida" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                        {n.status === "válida" ? <Building2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                        {n.status === "válida" ? "Válida" : "Cancelada"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{n.nNFSe}</TableCell>
                    <TableCell className="text-xs text-foreground/90 whitespace-nowrap">{formatarData(n.dhEmi)}</TableCell>
                    <TableCell className="text-muted-foreground">{n.dCompet ? n.dCompet.slice(0,7) : "—"}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{n.cnpjPrestador}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-medium" title={n.nomePrestador}>{n.nomePrestador}</TableCell>
                    <TableCell className="max-w-[180px] truncate" title={n.servico}>
                      <div className="font-medium text-foreground truncate">{n.servico || "—"}</div>
                      <div className={`text-[9px] font-bold mt-0.5 ${cat ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground/60"}`}>
                        {cat || "Sem categoria"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmtBRL(n.valor)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtBRL(n.vlrLiquido)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.issRetido === "Sim" && n.vlrIssRet > 0 ? fmtBRL(n.vlrIssRet) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${n.issRetido === "Sim" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-muted text-muted-foreground"}`}>
                        {n.issRetido}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.vlrIrrf > 0 ? fmtBRL(n.vlrIrrf) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.vlrCsll > 0 ? fmtBRL(n.vlrCsll) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.vlrPis > 0 ? fmtBRL(n.vlrPis) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.vlrCofins > 0 ? fmtBRL(n.vlrCofins) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{n.vlrInss > 0 ? fmtBRL(n.vlrInss) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Paginação */}
        {totalPagesTomadas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
            <span>{notasTomValidas.length.toLocaleString("pt-BR")} registros · Página {pageTomadas} de {totalPagesTomadas}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPageTomadas((p) => Math.max(1, p-1))} disabled={pageTomadas === 1} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/80 disabled:opacity-40 cursor-pointer">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPageTomadas((p) => Math.min(totalPagesTomadas, p+1))} disabled={pageTomadas === totalPagesTomadas} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/80 disabled:opacity-40 cursor-pointer">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
