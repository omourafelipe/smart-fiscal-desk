import { useMemo, useState } from "react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip as RechartTooltip,
} from "recharts";
import {
  TrendingUp, TrendingDown, Coins, Building2,
  Hash, Receipt, Info, ArrowUpRight, ArrowDownRight, Minus,
  Users, UserPlus, UserMinus, Percent, Landmark, BarChart3
} from "lucide-react";
import type { FiscalDocument } from "@/lib/db";

/* ─── Formatters ──────────────────────────────────────────────── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/* ─── Helpers ─────────────────────────────────────────────────── */
function getYearMonth(doc: FiscalDocument): string {
  return doc.data_competencia?.slice(0, 7) ?? "";
}

function last12Months(docs: FiscalDocument[]): string[] {
  const months: string[] = [];
  const latest = docs.reduce((acc: string, d) => {
    const ym = getYearMonth(d);
    return ym > acc ? ym : acc;
  }, "");

  const anchor = latest || new Date().toISOString().slice(0, 7);
  const [yStr, mStr] = anchor.split("-");
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);

  for (let i = 11; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) { mm += 12; yy--; }
    months.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return months;
}

function getClientesAtivos(docs: FiscalDocument[]): Set<string> {
  const clients = new Set<string>();
  docs.forEach((d) => {
    if (d.status_manual !== "Cancelado") {
      const c = d.cnpj_tomador || d.nome_tomador;
      if (c) clients.add(c);
    }
  });
  return clients;
}

/* ─── Types ───────────────────────────────────────────────────── */
interface SparkPoint { month: string; value: number }
type TrendDir = "up" | "down" | "flat";

interface KpiDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  colorHex: string;
  getValue: (docs: FiscalDocument[], allDocs: FiscalDocument[], prevDocs: FiscalDocument[], icSet: Set<string>) => number;
  getSparkPoints: (
    allDocs: FiscalDocument[],
    months: string[],
    icSet: Set<string>
  ) => SparkPoint[];
  format: (n: number) => string;
  tooltip: string;
}

/* ─── KPI Definitions ─────────────────────────────────────────── */
const KPI_DEFS: KpiDef[] = [
  {
    id: "bruto",
    label: "Receita Bruta",
    icon: TrendingUp,
    color: "oklch(0.546 0.225 264)",
    colorHex: "#2563EB",
    getValue: (docs) => docs.reduce((s, d) => s + d.valor_bruto, 0),
    getSparkPoints: (all, months) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + d.valor_bruto, 0),
      })),
    format: fmtBRLCompact,
    tooltip: "Soma de valor_bruto de todas as notas ativas (exclui canceladas) no período.",
  },
  {
    id: "liquido",
    label: "Receita Líquida",
    icon: BarChart3,
    color: "oklch(0.7 0.14 192)",
    colorHex: "#14B8A6",
    getValue: (docs) => docs.reduce((s, d) => s + d.valor_liquido, 0),
    getSparkPoints: (all, months) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + d.valor_liquido, 0),
      })),
    format: fmtBRLCompact,
    tooltip: "Receita Líquida = Bruto − Retenções Totais. Soma de valor_liquido das notas ativas.",
  },
  {
    id: "qtd-notas",
    label: "Número de NFS",
    icon: Hash,
    color: "oklch(0.55 0.18 300)",
    colorHex: "#7C3AED",
    getValue: (docs) => docs.length,
    getSparkPoints: (all, months) =>
      months.map((ym) => ({
        month: ym,
        value: all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        ).length,
      })),
    format: (n) => n.toLocaleString("pt-BR"),
    tooltip: "Quantidade total de notas fiscais de serviço ativas emitidas no período.",
  },
  {
    id: "ticket-medio",
    label: "Ticket Médio",
    icon: Receipt,
    color: "oklch(0.65 0.16 152)",
    colorHex: "#10B981",
    getValue: (docs) => {
      const bruto = docs.reduce((s, d) => s + d.valor_bruto, 0);
      const activeClients = getClientesAtivos(docs).size;
      return activeClients > 0 ? bruto / activeClients : 0;
    },
    getSparkPoints: (all, months) =>
      months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const bruto = filtered.reduce((s, d) => s + d.valor_bruto, 0);
        const activeClients = getClientesAtivos(filtered).size;
        return { month: ym, value: activeClients > 0 ? bruto / activeClients : 0 };
      }),
    format: fmtBRLCompact,
    tooltip: "Faturamento Bruto dividido pelo número de Clientes Ativos.",
  },
  {
    id: "clientes-ativos",
    label: "Clientes Ativos",
    icon: Users,
    color: "oklch(0.6 0.18 200)",
    colorHex: "#06B6D4",
    getValue: (docs) => getClientesAtivos(docs).size,
    getSparkPoints: (all, months) =>
      months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        return { month: ym, value: getClientesAtivos(filtered).size };
      }),
    format: (n) => n.toLocaleString("pt-BR"),
    tooltip: "Número de clientes tomadores únicos com notas ativas no período.",
  },
  {
    id: "novos-clientes",
    label: "Novos Clientes",
    icon: UserPlus,
    color: "oklch(0.68 0.19 140)",
    colorHex: "#22C55E",
    getValue: (docs, allDocs) => {
      const minCompet = docs.reduce((min, d) => (!d.data_competencia || d.data_competencia < min) ? (d.data_competencia || min) : min, "9999-12-31");
      const current = getClientesAtivos(docs);
      const historical = new Set<string>();
      allDocs.forEach((d) => {
        if (d.status_manual !== "Cancelado" && d.data_competencia && d.data_competencia < minCompet) {
          const c = d.cnpj_tomador || d.nome_tomador;
          if (c) historical.add(c);
        }
      });
      return Array.from(current).filter((c) => !historical.has(c)).length;
    },
    getSparkPoints: (all, months) => {
      return months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const current = getClientesAtivos(filtered);
        const historical = new Set<string>();
        all.forEach((d) => {
          if (d.status_manual !== "Cancelado" && d.data_competencia && d.data_competencia < `${ym}-01`) {
            const c = d.cnpj_tomador || d.nome_tomador;
            if (c) historical.add(c);
          }
        });
        return { month: ym, value: Array.from(current).filter((c) => !historical.has(c)).length };
      });
    },
    format: (n) => n.toLocaleString("pt-BR"),
    tooltip: "Clientes que faturaram no período mas nunca haviam faturado anteriormente.",
  },
  {
    id: "clientes-perdidos",
    label: "Clientes Perdidos",
    icon: UserMinus,
    color: "oklch(0.6 0.22 25)",
    colorHex: "#EF4444",
    getValue: (docs, _allDocs, prevDocs) => {
      const current = getClientesAtivos(docs);
      const prev = getClientesAtivos(prevDocs);
      return Array.from(prev).filter((c) => !current.has(c)).length;
    },
    getSparkPoints: (all, months) => {
      return months.map((ym, idx) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const current = getClientesAtivos(filtered);
        
        let prevYM = "";
        const [y, m] = ym.split("-").map(Number);
        if (m === 1) prevYM = `${y - 1}-12`;
        else prevYM = `${y}-${String(m - 1).padStart(2, "0")}`;

        const prevFiltered = all.filter(
          (d) => getYearMonth(d) === prevYM && d.status_manual !== "Cancelado"
        );
        const prev = getClientesAtivos(prevFiltered);
        return { month: ym, value: Array.from(prev).filter((c) => !current.has(c)).length };
      });
    },
    format: (n) => n.toLocaleString("pt-BR"),
    tooltip: "Clientes que faturaram no período anterior mas não registraram compras no período atual (Churn MoM).",
  },
  {
    id: "crescimento-pct",
    label: "Crescimento %",
    icon: Percent,
    color: "oklch(0.62 0.17 220)",
    colorHex: "#3B82F6",
    getValue: (docs, _allDocs, prevDocs) => {
      const bruto = docs.reduce((s, d) => s + d.valor_bruto, 0);
      const prevBruto = prevDocs.reduce((s, d) => s + d.valor_bruto, 0);
      if (prevBruto === 0) return bruto > 0 ? 100 : 0;
      return ((bruto - prevBruto) / prevBruto) * 100;
    },
    getSparkPoints: (all, months) => {
      return months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const bruto = filtered.reduce((s, d) => s + d.valor_bruto, 0);

        let prevYM = "";
        const [y, m] = ym.split("-").map(Number);
        if (m === 1) prevYM = `${y - 1}-12`;
        else prevYM = `${y}-${String(m - 1).padStart(2, "0")}`;

        const prevFiltered = all.filter(
          (d) => getYearMonth(d) === prevYM && d.status_manual !== "Cancelado"
        );
        const prevBruto = prevFiltered.reduce((s, d) => s + d.valor_bruto, 0);
        const val = prevBruto === 0 ? (bruto > 0 ? 100 : 0) : ((bruto - prevBruto) / prevBruto) * 100;
        return { month: ym, value: val };
      });
    },
    format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`,
    tooltip: "Variação percentual do faturamento bruto em relação ao período anterior.",
  },
  {
    id: "iss-retido",
    label: "ISS Retido",
    icon: Landmark,
    color: "oklch(0.76 0.15 80)",
    colorHex: "#D97706",
    getValue: (docs) => docs.reduce((s, d) => s + (d.vlr_iss_ret || 0), 0),
    getSparkPoints: (all, months) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + (d.vlr_iss_ret || 0), 0),
      })),
    format: fmtBRLCompact,
    tooltip: "Total de ISS retido na fonte pelos tomadores no período.",
  },
  {
    id: "tributos-totais",
    label: "Tributos Totais",
    icon: Coins,
    color: "oklch(0.72 0.17 60)",
    colorHex: "#EA580C",
    getValue: (docs) => docs.reduce((s, d) => s + (d.valor_retido || 0), 0),
    getSparkPoints: (all, months) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + (d.valor_retido || 0), 0),
      })),
    format: fmtBRLCompact,
    tooltip: "Soma de todos os impostos e retenções (ISS, IRRF, CSLL, PIS, COFINS, etc.).",
  },
  {
    id: "margem-tributaria",
    label: "Margem Tributária",
    icon: Percent,
    color: "oklch(0.58 0.16 280)",
    colorHex: "#6366F1",
    getValue: (docs) => {
      const bruto = docs.reduce((s, d) => s + d.valor_bruto, 0);
      const tributos = docs.reduce((s, d) => s + (d.valor_retido || 0), 0);
      return bruto > 0 ? (tributos / bruto) * 100 : 0;
    },
    getSparkPoints: (all, months) =>
      months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const bruto = filtered.reduce((s, d) => s + d.valor_bruto, 0);
        const tributos = filtered.reduce((s, d) => s + (d.valor_retido || 0), 0);
        return { month: ym, value: bruto > 0 ? (tributos / bruto) * 100 : 0 };
      }),
    format: (n) => `${n.toFixed(1)}%`,
    tooltip: "Proporção de Tributos Totais sobre o Faturamento Bruto.",
  },
  {
    id: "valor-medio-nota",
    label: "Valor Médio por Nota",
    icon: Receipt,
    color: "oklch(0.65 0.19 120)",
    colorHex: "#16A34A",
    getValue: (docs) => {
      const bruto = docs.reduce((s, d) => s + d.valor_bruto, 0);
      return docs.length > 0 ? bruto / docs.length : 0;
    },
    getSparkPoints: (all, months) =>
      months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const bruto = filtered.reduce((s, d) => s + d.valor_bruto, 0);
        return { month: ym, value: filtered.length > 0 ? bruto / filtered.length : 0 };
      }),
    format: fmtBRLCompact,
    tooltip: "Faturamento Bruto total dividido pelo número de Notas Fiscais emitidas.",
  },
];

/* ─── Tooltip Popup ───────────────────────────────────────────── */
function FormulaTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <button
        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="Fórmula do indicador"
        type="button"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {visible && (
        <div className="absolute right-0 mt-1 w-64 bg-slate-900 text-white rounded-lg p-2.5 shadow-xl text-xs z-50 pointer-events-none" role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}

/* ─── Sparkline Custom Tooltip ────────────────────────────────── */
function SparkTooltip({ active, payload, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow">
      <span>{format(payload[0].value)}</span>
    </div>
  );
}

/* ─── Trend Badge ─────────────────────────────────────────────── */
function TrendBadge({ pct, dir }: { pct: number; dir: TrendDir }) {
  if (dir === "flat")
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400 font-medium">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  if (dir === "up")
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md">
        <ArrowUpRight className="h-3.5 w-3.5" /> {fmtPct(pct)}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md">
      <ArrowDownRight className="h-3.5 w-3.5" /> {fmtPct(pct)}
    </span>
  );
}

/* ─── Single Executive KPI Card ───────────────────────────────── */
interface ExecKpiCardProps {
  def: KpiDef;
  value: number;
  prevValue: number;
  sparkData: SparkPoint[];
  onClick?: () => void;
}

function ExecKpiCard({ def, value, prevValue, sparkData, onClick }: ExecKpiCardProps) {
  const pct =
    prevValue !== 0
      ? ((value - prevValue) / Math.abs(prevValue)) * 100
      : value > 0
      ? 100
      : 0;
  const dir: TrendDir =
    Math.abs(pct) < 0.05 ? "flat" : pct > 0 ? "up" : "down";

  const hasPrev = prevValue !== 0 || value !== 0;

  return (
    <div
      className={`bg-card border border-border/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer ${
        onClick ? "hover:border-primary/40" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${def.colorHex}10` }}>
          <def.icon className="h-5 w-5" style={{ color: def.colorHex }} />
        </div>
        <FormulaTooltip text={def.tooltip} />
      </div>

      {/* Label */}
      <div className="text-xs text-slate-400 font-medium tracking-tight mb-1">{def.label}</div>

      {/* Main value */}
      <div className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
        {def.format(value)}
      </div>

      {/* Comparison + badge */}
      <div className="flex items-center gap-1.5 mb-4">
        {hasPrev ? (
          <>
            <TrendBadge pct={pct} dir={dir} />
            <span className="text-[10px] text-slate-400 font-medium">vs. anterior</span>
          </>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium">Sem comparativo</span>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-10 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={def.colorHex}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: def.colorHex }}
            />
            <RechartTooltip
              content={<SparkTooltip format={def.format} />}
              cursor={{ stroke: def.colorHex, strokeWidth: 1, strokeDasharray: "3 3" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom label */}
      <div className="text-[9px] text-slate-400/80 font-medium text-right mt-1.5">
        Histórico 12m
      </div>
    </div>
  );
}

/* ─── Secondary Indicator Row ─────────────────────────────────── */
interface SecondaryIndicatorsProps {
  bruto: number;
  retencoes: number;
  intercompany: number;
  qtdCanceladas: number;
}

function SecondaryIndicators({
  bruto,
  retencoes,
  intercompany,
  qtdCanceladas,
}: SecondaryIndicatorsProps) {
  const retencaoPct = bruto > 0 ? (retencoes / bruto) * 100 : 0;
  const icPct = bruto > 0 ? (intercompany / bruto) * 100 : 0;

  const items = [
    {
      id: "sec-retencao-media",
      label: "Retenção Média",
      value: `${retencaoPct.toFixed(2)}%`,
      sub: "Retenções ÷ Bruto",
      color: "#D97706",
    },
    {
      id: "sec-intercompany-pct",
      label: "Intercompany %",
      value: `${icPct.toFixed(2)}%`,
      sub: "Intercompany ÷ Bruto",
      color: "#EF4444",
    },
    {
      id: "sec-canceladas",
      label: "Notas Canceladas",
      value: qtdCanceladas.toLocaleString("pt-BR"),
      sub: "Excluídas dos KPIs",
      color: "#94A3B8",
    },
    {
      id: "sec-externo-pct",
      label: "Externo %",
      value: `${(100 - icPct).toFixed(2)}%`,
      sub: "Externo ÷ Bruto",
      color: "#14B8A6",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-sm">
      {items.map((item) => (
        <div key={item.id} id={item.id} className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>
            <div className="text-base font-bold text-slate-700 mt-0.5">{item.value}</div>
            <div className="text-[9px] text-slate-400">{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────────── */
interface ExecutiveKpisProps {
  activeDocs: FiscalDocument[];
  allDocs: FiscalDocument[];
  filteredDocs: FiscalDocument[];
  cnpjGrupoSet: Set<string>;
  onKpiClick?: (kpiId: string) => void;
}

export function ExecutiveKpis({
  activeDocs,
  allDocs,
  filteredDocs,
  cnpjGrupoSet,
  onKpiClick,
}: ExecutiveKpisProps) {
  const activeAllDocs = useMemo(
    () => allDocs.filter((d) => d.status_manual !== "Cancelado"),
    [allDocs]
  );

  const months = useMemo(() => last12Months(activeAllDocs), [activeAllDocs]);

  const prevActiveDocs = useMemo(() => {
    const dates = activeDocs
      .map((d) => d.data_competencia?.slice(0, 7))
      .filter(Boolean) as string[];

    if (dates.length === 0) return [];

    const minYM = dates.reduce((a, b) => (a < b ? a : b));
    const maxYM = dates.reduce((a, b) => (a > b ? a : b));

    function shiftBack(ym: string): string {
      const [y, m] = ym.split("-").map(Number);
      if (m === 1) return `${y - 1}-12`;
      return `${y}-${String(m - 1).padStart(2, "0")}`;
    }

    if (minYM === maxYM) {
      const prevYM = shiftBack(minYM);
      return activeAllDocs.filter((d) => d.data_competencia?.startsWith(prevYM));
    }

    const [minY, minM] = minYM.split("-").map(Number);
    const [maxY, maxM] = maxYM.split("-").map(Number);
    const prevMinYM = `${minY - 1}-${String(minM).padStart(2, "0")}`;
    const prevMaxYM = `${maxY - 1}-${String(maxM).padStart(2, "0")}`;

    return activeAllDocs.filter((d) => {
      const ym = d.data_competencia?.slice(0, 7) ?? "";
      return ym >= prevMinYM && ym <= prevMaxYM;
    });
  }, [activeDocs, activeAllDocs]);

  const qtdCanceladas = useMemo(
    () => filteredDocs.filter((d) => d.status_manual === "Cancelado").length,
    [filteredDocs]
  );

  const bruto = activeDocs.reduce((s, d) => s + d.valor_bruto, 0);
  const retencoes = activeDocs.reduce((s, d) => s + (d.valor_retido || 0), 0);
  const intercompany = activeDocs
    .filter((d) => cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador))
    .reduce((s, d) => s + d.valor_bruto, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
        {KPI_DEFS.map((def) => {
          const value = def.getValue(activeDocs, allDocs, prevActiveDocs, cnpjGrupoSet);
          const prevValue = def.getValue(prevActiveDocs, allDocs, prevActiveDocs, cnpjGrupoSet);
          const sparkData = def.getSparkPoints(activeAllDocs, months, cnpjGrupoSet);

          return (
            <ExecKpiCard
              key={def.id}
              def={def}
              value={value}
              prevValue={prevValue}
              sparkData={sparkData}
              onClick={onKpiClick ? () => onKpiClick(def.id) : undefined}
            />
          );
        })}
      </div>

      <SecondaryIndicators
        bruto={bruto}
        retencoes={retencoes}
        intercompany={intercompany}
        qtdCanceladas={qtdCanceladas}
      />
    </div>
  );
}
