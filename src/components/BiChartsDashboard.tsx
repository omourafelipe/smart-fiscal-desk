import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, ScatterChart, Scatter,
  ZAxis, ReferenceLine
} from "recharts";
import {
  TrendingUp, Users, DollarSign, Calculator, MapPin, Briefcase, Award,
  AlertTriangle, CheckCircle, ShieldAlert, Sparkles, HelpCircle, Flame, Clock
} from "lucide-react";
import type { FiscalDocument } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/* ─── Formatters ──────────────────────────────────────────────── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}K`;
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

const PALETA = ["#2563EB", "#10B981", "#F59E0B", "#7C3AED", "#06B6D4", "#EC4899", "#8B5CF6", "#F97316"];

interface BiChartsDashboardProps {
  filtrados: FiscalDocument[];
  allDocs: FiscalDocument[];
  empresas: any[];
  cnpjGrupoSet: Set<string>;
  openDrillDown: (config: any) => void;
}

export function BiChartsDashboard({
  filtrados,
  allDocs,
  empresas,
  cnpjGrupoSet,
  openDrillDown
}: BiChartsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"evolucao" | "clientes" | "servicos" | "sazonalidade" | "qualidade" | "benchmark">("evolucao");

  const activeFiltrados = useMemo(() => filtrados.filter(d => d.status_manual !== "Cancelado"), [filtrados]);

  // 1. Monthly Evolution Data
  const evolutionData = useMemo(() => {
    const monthsMap: Record<string, { bruto: number; liquido: number; prev: number }> = {};
    const historicalMap: Record<string, number> = {};

    // Get last 12 active months
    const allActive = allDocs.filter(d => d.status_manual !== "Cancelado");
    let latestYM = "";
    allActive.forEach(d => {
      const ym = d.data_competencia?.slice(0, 7);
      if (ym && ym > latestYM) latestYM = ym;
    });

    const anchor = latestYM || new Date().toISOString().slice(0, 7);
    const [yStr, mStr] = anchor.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);

    const labels: { ym: string; ymPrev: string; name: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      let mm = m - i;
      let yy = y;
      while (mm <= 0) { mm += 12; yy--; }
      const ymKey = `${yy}-${String(mm).padStart(2, "0")}`;
      const ymPrevKey = `${yy - 1}-${String(mm).padStart(2, "0")}`;
      labels.push({
        ym: ymKey,
        ymPrev: ymPrevKey,
        name: `${NOME_MES[String(mm).padStart(2, "0")]}/${String(yy).slice(2)}`
      });
    }

    labels.forEach(l => {
      monthsMap[l.ym] = { bruto: 0, liquido: 0, prev: 0 };
    });

    allDocs.forEach(d => {
      if (d.status_manual === "Cancelado") return;
      const ym = d.data_competencia?.slice(0, 7);
      if (!ym) return;

      // Current year range
      if (monthsMap[ym]) {
        monthsMap[ym].bruto += d.valor_bruto;
        monthsMap[ym].liquido += d.valor_liquido;
      }
      
      // Map all for previous calculations
      historicalMap[ym] = (historicalMap[ym] || 0) + d.valor_bruto;
    });

    labels.forEach(l => {
      if (monthsMap[l.ym]) {
        monthsMap[l.ym].prev = historicalMap[l.ymPrev] || 0;
      }
    });

    return labels.map((l, idx) => {
      const current = monthsMap[l.ym];
      let mediaMovel = current.bruto;
      if (idx >= 2) {
        const last3 = labels.slice(idx - 2, idx + 1).map(lbl => monthsMap[lbl.ym]?.bruto || 0);
        mediaMovel = last3.reduce((a, b) => a + b, 0) / 3;
      }
      return {
        name: l.name,
        bruto: current.bruto,
        liquido: current.liquido,
        prev: current.prev,
        mediaMovel,
        ym: l.ym
      };
    });
  }, [allDocs]);

  // 2. Accumulated Evolution
  const accumulatedData = useMemo(() => {
    let accBruto = 0;
    let accLiquido = 0;
    return evolutionData.map(d => {
      accBruto += d.bruto;
      accLiquido += d.liquido;
      return {
        name: d.name,
        brutoAcumulado: accBruto,
        liquidoAcumulado: accLiquido
      };
    });
  }, [evolutionData]);

  // 3. Receita por Tipo de Serviço
  const serviceTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    activeFiltrados.forEach(d => {
      const type = d.categoria_sintetica || d.categoria || "Outros Serviços";
      map[type] = (map[type] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeFiltrados]);

  // 4. Receita por LC116
  const lc116Data = useMemo(() => {
    const map: Record<string, number> = {};
    activeFiltrados.forEach(d => {
      const code = d.item_lista_servico || "Sem LC116";
      map[code] = (map[code] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [activeFiltrados]);

  // 5. Receita por NBS
  const nbsData = useMemo(() => {
    const map: Record<string, number> = {};
    activeFiltrados.forEach(d => {
      const code = d.codigo_nbs || "Sem NBS";
      map[code] = (map[code] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [activeFiltrados]);

  // 6. Receita por Município
  const cityData = useMemo(() => {
    const map: Record<string, number> = {};
    activeFiltrados.forEach(d => {
      const city = d.municipio || "Desconhecido";
      map[city] = (map[city] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [activeFiltrados]);

  // 7. Receita por Cliente
  const clientData = useMemo(() => {
    const map: Record<string, { faturamento: number; cnpj: string }> = {};
    activeFiltrados.forEach(d => {
      const name = d.nome_tomador || d.cnpj_tomador || "Desconhecido";
      const key = d.cnpj_tomador || name;
      if (!map[key]) map[key] = { faturamento: 0, cnpj: d.cnpj_tomador || "" };
      map[key].faturamento += d.valor_bruto;
    });
    return Object.entries(map).map(([name, info]) => ({ name, value: info.faturamento, cnpj: info.cnpj })).sort((a, b) => b.value - a.value);
  }, [activeFiltrados]);

  // 8. Tributos por Mês (Stacked Bar)
  const monthlyTaxesData = useMemo(() => {
    const map: Record<string, { iss: number; irrf: number; csll: number; pis: number; cofins: number }> = {};
    evolutionData.forEach(e => {
      map[e.ym] = { iss: 0, irrf: 0, csll: 0, pis: 0, cofins: 0 };
    });

    allDocs.forEach(d => {
      if (d.status_manual === "Cancelado") return;
      const ym = d.data_competencia?.slice(0, 7);
      if (ym && map[ym]) {
        map[ym].iss += d.vlr_iss_ret || 0;
        map[ym].irrf += d.vlr_irrf || 0;
        map[ym].csll += d.vlr_csll || 0;
        map[ym].pis += d.vlr_pis || 0;
        map[ym].cofins += d.vlr_cofins || 0;
      }
    });

    return evolutionData.map(e => ({
      name: e.name,
      ISS: map[e.ym].iss,
      IRRF: map[e.ym].irrf,
      CSLL: map[e.ym].csll,
      PIS: map[e.ym].pis,
      COFINS: map[e.ym].cofins
    }));
  }, [allDocs, evolutionData]);

  // 9. Pareto 80/20 data
  const paretoData = useMemo(() => {
    const total = clientData.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;
    return clientData.slice(0, 15).map(item => {
      cumulative += item.value;
      const percentage = total > 0 ? (cumulative / total) * 100 : 0;
      return {
        name: item.name.length > 15 ? item.name.slice(0, 15) + "..." : item.name,
        faturamento: item.value,
        pareto: parseFloat(percentage.toFixed(1)),
        cnpj: item.cnpj
      };
    });
  }, [clientData]);

  // 10. Curva ABC data
  const abcData = useMemo(() => {
    const total = clientData.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;
    let aCount = 0, bCount = 0, cCount = 0;
    let aVal = 0, bVal = 0, cVal = 0;

    clientData.forEach(item => {
      cumulative += item.value;
      const pct = total > 0 ? (cumulative / total) * 100 : 0;
      if (pct <= 70) {
        aCount++;
        aVal += item.value;
      } else if (pct <= 90) {
        bCount++;
        bVal += item.value;
      } else {
        cCount++;
        cVal += item.value;
      }
    });

    return [
      { name: "Classe A (Top 70%)", value: aVal, count: aCount, color: "#10B981", desc: "Clientes principais, geram 70% da receita" },
      { name: "Classe B (Intermediário 20%)", value: bVal, count: bCount, color: "#2563EB", desc: "Clientes médios, geram 20% da receita" },
      { name: "Classe C (Cauda Longa 10%)", value: cVal, count: cCount, color: "#F59E0B", desc: "Clientes menores, geram 10% da receita" }
    ];
  }, [clientData]);

  // 11. Sazonalidade Heatmap Data
  const heatmapData = useMemo(() => {
    const years = Array.from(new Set(allDocs.map(d => d.data_competencia?.slice(0, 4)).filter(Boolean))).sort();
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

    const matrix: Record<string, Record<string, number>> = {};
    years.forEach(y => {
      matrix[y] = {};
      months.forEach(m => {
        matrix[y][m] = 0;
      });
    });

    allDocs.forEach(d => {
      if (d.status_manual === "Cancelado") return;
      const y = d.data_competencia?.slice(0, 4);
      const m = d.data_competencia?.slice(5, 7);
      if (y && m && matrix[y] && matrix[y][m] !== undefined) {
        matrix[y][m] += d.valor_bruto;
      }
    });

    return { years, months, matrix };
  }, [allDocs]);

  // 12. Distribuição do Ticket Médio (Histograma)
  const ticketDistribution = useMemo(() => {
    let ranges = [
      { name: "< R$ 1k", min: 0, max: 1000, count: 0 },
      { name: "R$ 1k - 5k", min: 1000, max: 5000, count: 0 },
      { name: "R$ 5k - 20k", min: 5000, max: 20000, count: 0 },
      { name: "R$ 20k - 100k", min: 20000, max: 100000, count: 0 },
      { name: "> R$ 100k", min: 100000, max: 999999999, count: 0 }
    ];

    activeFiltrados.forEach(d => {
      const v = d.valor_bruto;
      for (const r of ranges) {
        if (v >= r.min && v < r.max) {
          r.count++;
          break;
        }
      }
    });

    return ranges;
  }, [activeFiltrados]);

  // 13. Scatter / Outliers Boxplot simulation
  const outliersData = useMemo(() => {
    const list = activeFiltrados.map((d, index) => ({
      index,
      id: d.id_nota,
      cliente: d.nome_tomador || d.cnpj_tomador || "Desconhecido",
      valor: d.valor_bruto
    }));

    const sum = list.reduce((s, x) => s + x.valor, 0);
    const avg = list.length > 0 ? sum / list.length : 0;
    
    // Standard deviation
    const variance = list.length > 0 ? list.reduce((s, x) => s + Math.pow(x.valor - avg, 2), 0) / list.length : 0;
    const stdDev = Math.sqrt(variance);

    return {
      list: list.slice(0, 100), // cap at 100 for graph performance
      avg,
      threshold: avg + 2 * stdDev
    };
  }, [activeFiltrados]);

  // 14. Waterfall Decomposição
  const waterfallData = useMemo(() => {
    const bruto = activeFiltrados.reduce((s, d) => s + d.valor_bruto, 0);
    const iss = activeFiltrados.reduce((s, d) => s + (d.vlr_iss_ret || 0), 0);
    const irrf = activeFiltrados.reduce((s, d) => s + (d.vlr_irrf || 0), 0);
    const csll = activeFiltrados.reduce((s, d) => s + (d.vlr_csll || 0), 0);
    const pis = activeFiltrados.reduce((s, d) => s + (d.vlr_pis || 0), 0);
    const cofins = activeFiltrados.reduce((s, d) => s + (d.vlr_cofins || 0), 0);
    const liquido = bruto - (iss + irrf + csll + pis + cofins);

    return [
      { name: "Faturamento Bruto", range: [0, bruto], display: bruto, fill: "#2563EB" },
      { name: "ISS Retido", range: [bruto - iss, bruto], display: -iss, fill: "#F59E0B" },
      { name: "IRRF", range: [bruto - iss - irrf, bruto - iss], display: -irrf, fill: "#EA580C" },
      { name: "CSLL", range: [bruto - iss - irrf - csll, bruto - iss - irrf], display: -csll, fill: "#F97316" },
      { name: "PIS/COFINS", range: [bruto - iss - irrf - csll - (pis + cofins), bruto - iss - irrf - csll], display: -(pis + cofins), fill: "#EC4899" },
      { name: "Valor Líquido", range: [0, liquido], display: liquido, fill: "#10B981" },
    ];
  }, [activeFiltrados]);

  // 15. Forecast 30, 60, 90 dias (linear regression)
  const forecastData = useMemo(() => {
    const hist = evolutionData.filter(e => e.bruto > 0);
    if (hist.length < 3) return [];

    // Fit line: y = ax + b
    const n = hist.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    hist.forEach((d, idx) => {
      const x = idx;
      const y = d.bruto;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project 3 periods ahead
    const result = hist.map((d, idx) => ({
      name: d.name,
      bruto: d.bruto,
      forecast: null as number | null
    }));

    const lastIdx = hist.length - 1;
    const monthsAhead = [
      { name: "D+30 (Proj.)", x: lastIdx + 1 },
      { name: "D+60 (Proj.)", x: lastIdx + 2 },
      { name: "D+90 (Proj.)", x: lastIdx + 3 }
    ];

    // Seed last real value into forecast line for continuity
    if (result.length > 0) {
      result[result.length - 1].forecast = result[result.length - 1].bruto;
    }

    monthsAhead.forEach(m => {
      result.push({
        name: m.name,
        bruto: 0,
        forecast: Math.max(0, slope * m.x + intercept)
      });
    });

    return result;
  }, [evolutionData]);

  // 16. Benchmark computations
  const benchmarks = useMemo(() => {
    let maxMonthFaturamento = 0;
    let minMonthFaturamento = Infinity;
    let maxMonthName = "";
    let minMonthName = "";

    // Monthly faturamento map
    const monthBruto: Record<string, number> = {};
    allDocs.forEach(d => {
      if (d.status_manual === "Cancelado") return;
      const ym = d.data_competencia?.slice(0, 7);
      if (ym) {
        monthBruto[ym] = (monthBruto[ym] || 0) + d.valor_bruto;
      }
    });

    Object.entries(monthBruto).forEach(([ym, val]) => {
      if (val > maxMonthFaturamento) {
        maxMonthFaturamento = val;
        maxMonthName = ym;
      }
      if (val < minMonthFaturamento) {
        minMonthFaturamento = val;
        minMonthName = ym;
      }
    });

    let maxInvoice = 0;
    let maxInvoiceId = "";
    let maxRetention = 0;
    let maxRetentionId = "";

    allDocs.forEach(d => {
      if (d.status_manual === "Cancelado") return;
      if (d.valor_bruto > maxInvoice) {
        maxInvoice = d.valor_bruto;
        maxInvoiceId = d.id_nota;
      }
      if (d.valor_retido > maxRetention) {
        maxRetention = d.valor_retido;
        maxRetentionId = d.id_nota;
      }
    });

    const topClient = clientData[0] || { name: "Nenhum", value: 0 };

    return {
      maxMonth: { name: maxMonthName, value: maxMonthFaturamento },
      minMonth: { name: minMonthName, value: minMonthFaturamento === Infinity ? 0 : minMonthFaturamento },
      maxInvoice: { id: maxInvoiceId, value: maxInvoice },
      maxRetention: { id: maxRetentionId, value: maxRetention },
      topClient
    };
  }, [allDocs, clientData]);

  // 17. Data Quality computations
  const dataQuality = useMemo(() => {
    const list = allDocs;
    let duplicadas = 0;
    let canceladas = 0;
    let semClassificacao = 0;
    let lc116Ausente = 0;
    let nbsAusente = 0;
    let tomadoresSemDoc = 0;
    let xmlInvalidos = 0;
    let inconsistenciaTributaria = 0;

    const seenIds = new Set<string>();

    list.forEach(d => {
      if (seenIds.has(d.id_nota)) {
        duplicadas++;
      }
      seenIds.add(d.id_nota);

      if (d.status_manual === "Cancelado") {
        canceladas++;
      } else {
        if (!d.tipo_servico || d.tipo_servico === "Outros Serviços") semClassificacao++;
        if (!d.item_lista_servico) lc116Ausente++;
        if (!d.codigo_nbs) nbsAusente++;
        if (!d.cnpj_tomador || d.cnpj_tomador.replace(/\D/g, "") === "") tomadoresSemDoc++;

        // Inconsistência: Retido SIM mas valor 0, ou Retido NÃO mas valor > 0
        const retidoValor = d.valor_retido || 0;
        const retidoFlag = d.iss_retido;
        if (retidoFlag === "Sim" && retidoValor === 0) inconsistenciaTributaria++;
        if (retidoFlag === "Não" && d.vlr_iss_ret && d.vlr_iss_ret > 0) inconsistenciaTributaria++;
      }
    });

    return {
      duplicadas,
      canceladas,
      semClassificacao,
      lc116Ausente,
      nbsAusente,
      tomadoresSemDoc,
      xmlInvalidos,
      inconsistenciaTributaria,
      total: list.length
    };
  }, [allDocs]);

  return (
    <div className="space-y-6">
      {/* Abas Temáticas */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1 shrink-0 scrollbar-none">
        {[
          { id: "evolucao", label: "Evolução & Projeções", icon: TrendingUp },
          { id: "clientes", label: "Clientes & Pareto", icon: Users },
          { id: "servicos", label: "Serviços & Códigos", icon: Briefcase },
          { id: "sazonalidade", label: "Sazonalidade & Outliers", icon: Clock },
          { id: "qualidade", label: "Qualidade dos Dados", icon: AlertTriangle },
          { id: "benchmark", label: "Benchmarks BI", icon: Award },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors shrink-0 cursor-pointer ${
                active
                  ? "bg-white border-x border-t border-slate-200 text-primary shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === "evolucao" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Evolução Mensal */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Evolução Mensal da Receita</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="bruto" name="Receita Bruta" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorBruto)" />
                  <Line type="monotone" dataKey="prev" name="Período Anterior" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="mediaMovel" name="Média Móvel (3m)" stroke="#7C3AED" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evolução Acumulada */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Evolução Acumulada da Receita</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accumulatedData}>
                  <defs>
                    <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Area type="monotone" dataKey="brutoAcumulado" name="Bruto Acumulado" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorAcc)" />
                  <Area type="monotone" dataKey="liquidoAcumulado" name="Líquido Acumulado" stroke="#06B6D4" strokeWidth={1.5} fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparativo Ano x Ano */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Comparativo Ano x Ano</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="bruto" name="Ano Corrente" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="prev" name="Ano Anterior" fill="#94A3B8" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast 30, 60 e 90 dias */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Forecast de Receita (Linear Proj.)</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="bruto" name="Histórico Real" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="forecast" name="Forecast Projeção" stroke="#EC4899" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Waterfall */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Waterfall do Faturamento Líquido</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmtBRL(Math.abs(Number(v)))} />
                  <Bar dataKey="range" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={entry.fill}
                        onClick={() => openDrillDown({
                          title: `NFS-e - Detalhes: ${entry.name}`,
                          filter: { type: "tributo", value: entry.name }
                        })}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "clientes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Receita por Cliente */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Receita por Cliente (Maiores Tomadores)</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientData.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]}>
                    {clientData.slice(0, 10).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        onClick={() => openDrillDown({
                          title: `NFS-e - Cliente: ${entry.name}`,
                          filter: { type: "cliente", value: entry.name, cnpj: entry.cnpj }
                        })}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pareto 80/20 */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Análise de Pareto (Concentração 80/20)</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                  <YAxis yAxisId="left" tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="faturamento" fill="#2563EB" radius={[4, 4, 0, 0]}>
                    {paretoData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        onClick={() => openDrillDown({
                          title: `NFS-e - Cliente: ${entry.name}`,
                          filter: { type: "cliente", value: entry.name, cnpj: entry.cnpj }
                        })}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="pareto" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Curva ABC */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Curva ABC de Clientes</h4>
            <div className="flex flex-col md:flex-row items-center gap-6 h-64">
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={abcData}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {abcData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => fmtBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {abcData.map((c, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-xs font-bold text-slate-700">{c.name}</span>
                      <span className="text-xs font-mono font-bold text-slate-500 ml-auto">{fmtBRLCompact(c.value)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pl-5 leading-normal">{c.desc} ({c.count} clientes)</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking dos Clientes Table */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Ranking Completo de Clientes</h4>
            <div className="h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-right text-xs">Faturamento</TableHead>
                    <TableHead className="text-center text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientData.slice(0, 15).map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtBRL(c.value)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className="cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 text-[9px] border-0"
                          onClick={() => openDrillDown({
                            title: `NFS-e - Cliente: ${c.name}`,
                            filter: { type: "cliente", value: c.name, cnpj: c.cnpj }
                          })}
                        >
                          Ver Notas
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "servicos" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Receita por Tipo de Serviço */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Receita por Categoria Sintética</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceTypeData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2.5}
                    dataKey="value"
                  >
                    {serviceTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tributos por Mês (Stacked Bar) */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Demonstrativo de Tributação por Mês</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTaxesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="ISS" stackId="a" fill="#D97706" />
                  <Bar dataKey="IRRF" stackId="a" fill="#EA580C" />
                  <Bar dataKey="CSLL" stackId="a" fill="#F97316" />
                  <Bar dataKey="PIS" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="COFINS" stackId="a" fill="#EC4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Receita por LC116 */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Receita por LC116</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lc116Data} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Bar dataKey="value" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Receita por NBS */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Receita por NBS</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nbsData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={v => fmtBRL(Number(v))} />
                  <Bar dataKey="value" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sazonalidade" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Heatmap de Sazonalidade */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm lg:col-span-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Heatmap de Sazonalidade de Faturamento (Ano x Mês)</h4>
            <div className="overflow-x-auto">
              <div className="min-w-[600px] space-y-2">
                <div className="grid grid-cols-13 gap-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Ano</div>
                  {heatmapData.months.map(m => (
                    <div key={m} className="text-center text-[10px] font-bold text-slate-400 uppercase">{NOME_MES[m]}</div>
                  ))}
                </div>

                {heatmapData.years.map(y => (
                  <div key={y} className="grid grid-cols-13 gap-1 items-center">
                    <div className="text-xs font-bold text-slate-600 font-mono">{y}</div>
                    {heatmapData.months.map(m => {
                      const val = heatmapData.matrix[y]?.[m] || 0;
                      let bgOpacity = "bg-primary/5";
                      if (val > 100000) bgOpacity = "bg-primary/90 text-white";
                      else if (val > 50000) bgOpacity = "bg-primary/60 text-white";
                      else if (val > 10000) bgOpacity = "bg-primary/30 text-slate-800";
                      else if (val > 0) bgOpacity = "bg-primary/10 text-slate-600";

                      return (
                        <div
                          key={m}
                          className={`h-10 flex flex-col justify-center items-center rounded-lg ${bgOpacity} text-[9px] font-mono font-medium p-1 text-center truncate cursor-pointer hover:ring-2 hover:ring-primary/40`}
                          title={`Faturamento: ${fmtBRL(val)}`}
                          onClick={() => openDrillDown({
                            title: `NFS-e - ${NOME_MES[m]}/${y}`,
                            filter: { type: "competencia", value: `${m}/${y}` }
                          })}
                        >
                          {val > 0 ? fmtBRLCompact(val) : "—"}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-primary/5 rounded border border-slate-200" /> Sem faturamento</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-primary/10 rounded" /> Até R$ 10k</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-primary/30 rounded" /> R$ 10k - 50k</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-primary/60 rounded" /> R$ 50k - 100k</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-primary/90 rounded" /> acima de R$ 100k</span>
            </div>
          </div>

          {/* Distribuição do Ticket Médio */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Distribuição do Ticket por Nota</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Notas Fiscais" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Outliers Boxplot (Dispersion) */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Detecção de Outliers e Anomalias</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" dataKey="index" name="Nº Nota" tick={{ fontSize: 9 }} />
                  <YAxis type="number" dataKey="valor" name="Valor (R$)" tickFormatter={v => fmtBRLCompact(v)} tick={{ fontSize: 9 }} />
                  <ZAxis type="number" range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={v => fmtBRL(Number(v))} />
                  <Scatter name="Valor das Notas" data={outliersData.list} fill="#2563EB" />
                  <ReferenceLine y={outliersData.avg} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Média', position: 'top', fill: '#10B981', fontSize: 10 }} />
                  <ReferenceLine y={outliersData.threshold} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Limiar Outlier', position: 'top', fill: '#EF4444', fontSize: 10 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "qualidade" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          {[
            { label: "Notas Duplicadas", count: dataQuality.duplicadas, severity: "danger", desc: "Notas fiscais com IDs repetidos no sistema." },
            { label: "Notas Canceladas", count: dataQuality.canceladas, severity: "warning", desc: "Notas identificadas como canceladas pelo emissor." },
            { label: "Serviços Sem Classificação", count: dataQuality.semClassificacao, severity: "warning", desc: "Serviços sob a classificação de 'Outros Serviços'." },
            { label: "LC116 Ausente", count: dataQuality.lc116Ausente, severity: "danger", desc: "XMLs sem código da Lei Complementar 116." },
            { label: "NBS Ausente", count: dataQuality.nbsAusente, severity: "warning", desc: "XMLs sem a Nomenclatura Brasileira de Serviços." },
            { label: "Tomadores Sem Documento", count: dataQuality.tomadoresSemDoc, severity: "danger", desc: "Clientes cadastrados sem CNPJ ou CPF válido." },
            { label: "XMLs Inválidos", count: dataQuality.xmlInvalidos, severity: "danger", desc: "Arquivos com erros graves na importação ou parser." },
            { label: "Inconsistências Tributárias", count: dataQuality.inconsistenciaTributaria, severity: "warning", desc: "ISS retido declarado inconsistente com os valores." },
          ].map((item, idx) => {
            const hasIssues = item.count > 0;
            return (
              <div key={idx} className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{item.label}</span>
                    {hasIssues ? (
                      <span className={`h-2.5 w-2.5 rounded-full ${item.severity === "danger" ? "bg-rose-500 animate-pulse" : "bg-amber-500"}`} />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <span className={`text-2xl font-bold font-mono ${hasIssues ? "text-slate-800" : "text-emerald-600"}`}>
                    {item.count}
                  </span>
                  <span className="text-[9px] text-slate-400">de {dataQuality.total} notas</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "benchmark" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {[
            { label: "Maior Faturamento Histórico", value: fmtBRL(benchmarks.maxMonth.value), sub: `Competência: ${benchmarks.maxMonth.name || "—"}`, icon: Flame, color: "text-amber-500" },
            { label: "Menor Faturamento Histórico", value: fmtBRL(benchmarks.minMonth.value), sub: `Competência: ${benchmarks.minMonth.name || "—"}`, icon: Clock, color: "text-blue-500" },
            { label: "Maior Ticket Único", value: fmtBRL(benchmarks.maxInvoice.value), sub: `Nota ID: ${benchmarks.maxInvoice.id || "—"}`, icon: DollarSign, color: "text-emerald-500" },
            { label: "Maior Cliente Tomador", value: benchmarks.topClient.name, sub: `Volume Acumulado: ${fmtBRL(benchmarks.topClient.value)}`, icon: Users, color: "text-primary" },
            { label: "Maior Retenção Tributária", value: fmtBRL(benchmarks.maxRetention.value), sub: `Nota ID: ${benchmarks.maxRetention.id || "—"}`, icon: Calculator, color: "text-rose-500" },
          ].map((item, idx) => (
            <div key={idx} className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex items-start gap-4">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl shrink-0">
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{item.label}</span>
                <span className="text-lg font-bold text-slate-800 mt-1 block truncate" title={item.value}>{item.value}</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={item.sub}>{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
