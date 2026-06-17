import { useMemo, useRef, useState } from "react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip as RechartTooltip,
} from "recharts";
import {
  TrendingUp, TrendingDown, Coins, Building2,
  Hash, Receipt, Info, ArrowUpRight, ArrowDownRight, Minus,
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
  // returns "YYYY-MM"
  return doc.data_competencia?.slice(0, 7) ?? "";
}

/**
 * Build the last 12 calendar months (YYYY-MM) ending at the most-recent month
 * present in the data (or current month if no data).
 */
function last12Months(docs: FiscalDocument[]): string[] {
  const months: string[] = [];
  // find the latest month in docs
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

/* ─── Types ───────────────────────────────────────────────────── */
interface SparkPoint { month: string; value: number }

type TrendDir = "up" | "down" | "flat";

interface KpiDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  colorHex: string;
  getValue: (docs: FiscalDocument[], icSet: Set<string>) => number;
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
    label: "Faturamento Bruto",
    icon: TrendingUp,
    color: "oklch(0.546 0.225 264)",
    colorHex: "#2563EB",
    getValue: (docs) => docs.reduce((s, d) => s + d.valor_bruto, 0),
    getSparkPoints: (all, months, _icSet) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + d.valor_bruto, 0),
      })),
    format: fmtBRLCompact,
    tooltip:
      "Soma de valor_bruto de todas as notas ativas (exclui canceladas) no período filtrado.",
  },
  {
    id: "liquido",
    label: "Faturamento Líquido",
    icon: TrendingUp,
    color: "oklch(0.7 0.14 192)",
    colorHex: "#14B8A6",
    getValue: (docs) => docs.reduce((s, d) => s + d.valor_liquido, 0),
    getSparkPoints: (all, months, _icSet) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + d.valor_liquido, 0),
      })),
    format: fmtBRLCompact,
    tooltip:
      "Faturamento Líquido = Bruto − Retenções. Soma de valor_liquido das notas ativas.",
  },
  {
    id: "retencoes",
    label: "Retenções",
    icon: Coins,
    color: "oklch(0.75 0.18 75)",
    colorHex: "#F59E0B",
    getValue: (docs) => docs.reduce((s, d) => s + d.valor_retido, 0),
    getSparkPoints: (all, months, _icSet) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter((d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado")
          .reduce((s, d) => s + d.valor_retido, 0),
      })),
    format: fmtBRLCompact,
    tooltip:
      "Total de tributos retidos na fonte (ISS, PIS, COFINS, IRRF etc.). Fórmula: Σ valor_retido das notas ativas.",
  },
  {
    id: "intercompany",
    label: "Intercompany",
    icon: Building2,
    color: "oklch(0.63 0.21 27)",
    colorHex: "#EF4444",
    getValue: (docs, icSet) =>
      docs
        .filter(
          (d) =>
            icSet.has(d.cnpj_prestador) && icSet.has(d.cnpj_tomador)
        )
        .reduce((s, d) => s + d.valor_bruto, 0),
    getSparkPoints: (all, months, icSet) =>
      months.map((ym) => ({
        month: ym,
        value: all
          .filter(
            (d) =>
              getYearMonth(d) === ym &&
              d.status_manual !== "Cancelado" &&
              icSet.has(d.cnpj_prestador) &&
              icSet.has(d.cnpj_tomador)
          )
          .reduce((s, d) => s + d.valor_bruto, 0),
      })),
    format: fmtBRLCompact,
    tooltip:
      "Operações entre empresas do mesmo grupo econômico (prestador e tomador ambos cadastrados no grupo). Fórmula: Σ valor_bruto notas Intercompany ativas.",
  },
  {
    id: "qtd-notas",
    label: "Qtd. de Notas",
    icon: Hash,
    color: "oklch(0.55 0.18 300)",
    colorHex: "#7C3AED",
    getValue: (docs) => docs.length,
    getSparkPoints: (all, months, _icSet) =>
      months.map((ym) => ({
        month: ym,
        value: all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        ).length,
      })),
    format: (n) => n.toLocaleString("pt-BR"),
    tooltip:
      "Quantidade de NFS-e com status Ativo no período filtrado. Notas Canceladas são excluídas automaticamente.",
  },
  {
    id: "ticket-medio",
    label: "Ticket Médio",
    icon: Receipt,
    color: "oklch(0.65 0.16 152)",
    colorHex: "#10B981",
    getValue: (docs) => {
      const bruto = docs.reduce((s, d) => s + d.valor_bruto, 0);
      return docs.length > 0 ? bruto / docs.length : 0;
    },
    getSparkPoints: (all, months, _icSet) =>
      months.map((ym) => {
        const filtered = all.filter(
          (d) => getYearMonth(d) === ym && d.status_manual !== "Cancelado"
        );
        const bruto = filtered.reduce((s, d) => s + d.valor_bruto, 0);
        return { month: ym, value: filtered.length > 0 ? bruto / filtered.length : 0 };
      }),
    format: fmtBRLCompact,
    tooltip:
      "Ticket Médio = Faturamento Bruto ÷ Quantidade de Notas Ativas. Indica o valor médio por nota fiscal emitida.",
  },
];

/* ─── Tooltip Popup ───────────────────────────────────────────── */
function FormulaTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="exec-kpi-tooltip-wrapper">
      <button
        className="exec-kpi-info-btn"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="Fórmula do indicador"
        type="button"
      >
        <Info className="h-3 w-3" />
      </button>
      {visible && (
        <div className="exec-kpi-tooltip-popup" role="tooltip">
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
    <div className="exec-spark-tooltip">
      <span>{format(payload[0].value)}</span>
    </div>
  );
}

/* ─── Trend Badge ─────────────────────────────────────────────── */
function TrendBadge({ pct, dir }: { pct: number; dir: TrendDir }) {
  if (dir === "flat")
    return (
      <span className="exec-trend-badge exec-trend-flat">
        <Minus className="h-2.5 w-2.5" /> —
      </span>
    );
  if (dir === "up")
    return (
      <span className="exec-trend-badge exec-trend-up">
        <ArrowUpRight className="h-2.5 w-2.5" /> {fmtPct(pct)}
      </span>
    );
  return (
    <span className="exec-trend-badge exec-trend-down">
      <ArrowDownRight className="h-2.5 w-2.5" /> {fmtPct(pct)}
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
      className={`exec-kpi-card${onClick ? " exec-kpi-clickable" : ""}`}
      style={{ "--kpi-color": def.colorHex } as React.CSSProperties}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      {/* Top row */}
      <div className="exec-kpi-top">
        <div className="exec-kpi-icon" style={{ background: `${def.colorHex}18` }}>
          <def.icon className="h-4 w-4" style={{ color: def.colorHex }} />
        </div>
        <FormulaTooltip text={def.tooltip} />
      </div>

      {/* Label */}
      <div className="exec-kpi-label">{def.label}</div>

      {/* Main value */}
      <div className="exec-kpi-value">{def.format(value)}</div>

      {/* Comparison + badge */}
      <div className="exec-kpi-comparison">
        {hasPrev ? (
          <>
            <TrendBadge pct={pct} dir={dir} />
            <span className="exec-kpi-prev-label">vs. período anterior</span>
          </>
        ) : (
          <span className="exec-kpi-prev-label">Sem comparativo</span>
        )}
      </div>

      {/* Sparkline */}
      <div className="exec-kpi-sparkline">
        <ResponsiveContainer width="100%" height={44}>
          <LineChart data={sparkData} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
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
      <div className="exec-kpi-sparkline-label">
        Últimos 12 meses
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
      color: "#F59E0B",
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
    <div className="exec-secondary-strip">
      {items.map((item) => (
        <div key={item.id} id={item.id} className="exec-secondary-item">
          <div className="exec-secondary-dot" style={{ background: item.color }} />
          <div>
            <div className="exec-secondary-label">{item.label}</div>
            <div className="exec-secondary-value">{item.value}</div>
            <div className="exec-secondary-sub">{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────────── */
interface ExecutiveKpisProps {
  /** Current-period active docs (cancelled already excluded by filtrados + ativos logic) */
  activeDocs: FiscalDocument[];
  /** All docs in DB (for sparkline historical data, unfiltered by period but cancelled-excluded) */
  allDocs: FiscalDocument[];
  /** All filtered docs including cancelled (for cancelled count) */
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
  // Sparkline months: last 12 months relative to all active data
  const activeAllDocs = useMemo(
    () => allDocs.filter((d) => d.status_manual !== "Cancelado"),
    [allDocs]
  );

  const months = useMemo(() => last12Months(activeAllDocs), [activeAllDocs]);

  // Previous period: the month before the EARLIEST month in current activeDocs
  // For simplicity: compare against previous period data from all docs
  const prevActiveDocs = useMemo(() => {
    // Find current period's date range
    const dates = activeDocs
      .map((d) => d.data_competencia?.slice(0, 7))
      .filter(Boolean) as string[];

    if (dates.length === 0) return [];

    const minYM = dates.reduce((a, b) => (a < b ? a : b));
    const maxYM = dates.reduce((a, b) => (a > b ? a : b));

    // Shift each month back by 1 month
    function shiftBack(ym: string): string {
      const [y, m] = ym.split("-").map(Number);
      if (m === 1) return `${y - 1}-12`;
      return `${y}-${String(m - 1).padStart(2, "0")}`;
    }

    // Single month selected?
    if (minYM === maxYM) {
      const prevYM = shiftBack(minYM);
      return activeAllDocs.filter((d) => d.data_competencia?.startsWith(prevYM));
    }

    // Multi-month: shift whole range back by 1 year
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

  const bruto       = KPI_DEFS[0].getValue(activeDocs, cnpjGrupoSet);
  const retencoes   = KPI_DEFS[2].getValue(activeDocs, cnpjGrupoSet);
  const intercompany = KPI_DEFS[3].getValue(activeDocs, cnpjGrupoSet);

  return (
    <div className="exec-kpi-section">
      {/* 6-card grid */}
      <div className="exec-kpi-grid">
        {KPI_DEFS.map((def) => {
          const value     = def.getValue(activeDocs, cnpjGrupoSet);
          const prevValue = def.getValue(prevActiveDocs, cnpjGrupoSet);
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

      {/* Secondary indicators strip */}
      <SecondaryIndicators
        bruto={bruto}
        retencoes={retencoes}
        intercompany={intercompany}
        qtdCanceladas={qtdCanceladas}
      />
    </div>
  );
}
