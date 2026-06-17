import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts";
import { Tag, Filter } from "lucide-react";
import type { FiscalDocument } from "@/lib/db";

/* ─── Props ─────────────────────────────────────────────────────── */
interface ServiceAnalysisProps {
  /** Docs já filtrados pelos filtros globais (empresa, competência, status, operação) */
  filtrados: FiscalDocument[];
  /** Called when user clicks a service bar/slice to open drill-down */
  onServiceDrillDown?: (serviceKey: string, serviceLabel: string) => void;
}

/* ─── Palette ────────────────────────────────────────────────────── */
const SERVICE_PALETTE = [
  "#2563EB", "#14B8A6", "#7C3AED", "#F59E0B",
  "#EC4899", "#10B981", "#F97316", "#06B6D4",
  "#8B5CF6", "#EF4444", "#94A3B8",
];

/* ─── Formatters ─────────────────────────────────────────────────── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/* ─── Axis tick styles ───────────────────────────────────────────── */
const axTick = { fontSize: 10, fill: "oklch(0.51 0.046 257)" };
const axGrid  = "oklch(0.918 0.015 253)";

/* ─── Service grouping key ───────────────────────────────────────── */
function serviceKey(doc: FiscalDocument): string {
  return (
    doc.item_lista_servico?.trim() ||
    doc.codigo_servico?.trim() ||
    (doc.descricao_servico?.trim()
      ? doc.descricao_servico.trim().slice(0, 40)
      : "") ||
    "Sem classificação"
  );
}

function serviceLabel(doc: FiscalDocument): string {
  const code = doc.item_lista_servico?.trim() || doc.codigo_servico?.trim() || "";
  const desc = doc.descricao_servico?.trim() || "";
  if (code && desc) return `${code} — ${desc.slice(0, 45)}`;
  if (code) return code;
  if (desc) return desc.slice(0, 50);
  return "Sem classificação";
}

/* ─── Grouped service row ────────────────────────────────────────── */
interface ServiceRow {
  key: string;
  label: string;
  totalBruto: number;
  qtdNotas: number;
  ticketMedio: number;
  color: string;
  pct: number;
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function SectionHeader({
  title, subtitle, accentColor, hint,
}: {
  title: string; subtitle?: string; accentColor?: string; hint?: string;
}) {
  return (
    <div className="chart-section-header">
      {accentColor && <div className="chart-accent-bar" style={{ background: accentColor }} />}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {hint && (
          <span className="chart-filter-hint">
            <Filter className="h-2.5 w-2.5" />
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

/* Custom tooltip — Revenue */
function RevenueTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ServiceRow;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label" style={{ maxWidth: 260, whiteSpace: "normal", lineHeight: 1.4 }}>
        {d.label}
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">
          <span className="chart-tooltip-dot" style={{ background: payload[0].color }} />
          Faturamento Bruto
        </span>
        <span className="chart-tooltip-value">{fmtBRL(d.totalBruto)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name" style={{ color: "var(--color-muted-foreground)" }}>
          Participação
        </span>
        <span className="chart-tooltip-value" style={{ color: "var(--color-muted-foreground)" }}>
          {fmtPct(d.pct)}
        </span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name" style={{ color: "var(--color-muted-foreground)" }}>
          Qtd. Notas
        </span>
        <span className="chart-tooltip-value" style={{ color: "var(--color-muted-foreground)" }}>
          {d.qtdNotas}
        </span>
      </div>
    </div>
  );
}

function CountTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ServiceRow;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label" style={{ maxWidth: 260, whiteSpace: "normal", lineHeight: 1.4 }}>
        {d.label}
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">
          <span className="chart-tooltip-dot" style={{ background: payload[0].color }} />
          Qtd. de Notas
        </span>
        <span className="chart-tooltip-value">{d.qtdNotas}</span>
      </div>
    </div>
  );
}

function TicketTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ServiceRow;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label" style={{ maxWidth: 260, whiteSpace: "normal", lineHeight: 1.4 }}>
        {d.label}
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">
          <span className="chart-tooltip-dot" style={{ background: payload[0].color }} />
          Ticket Médio
        </span>
        <span className="chart-tooltip-value">{fmtBRL(d.ticketMedio)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name" style={{ color: "var(--color-muted-foreground)" }}>
          Total Bruto
        </span>
        <span className="chart-tooltip-value" style={{ color: "var(--color-muted-foreground)" }}>
          {fmtBRLCompact(d.totalBruto)}
        </span>
      </div>
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label" style={{ maxWidth: 260, whiteSpace: "normal", lineHeight: 1.4 }}>
        {p.name}
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">
          <span className="chart-tooltip-dot" style={{ background: p.payload.fill || p.payload.color }} />
          Faturamento
        </span>
        <span className="chart-tooltip-value">{fmtBRL(p.value)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name" style={{ color: "var(--color-muted-foreground)" }}>
          Participação
        </span>
        <span className="chart-tooltip-value" style={{ color: "var(--color-muted-foreground)" }}>
          {fmtPct(p.payload.pct)}
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function ServiceAnalysis({ filtrados, onServiceDrillDown }: ServiceAnalysisProps) {
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  /* ── Build service groups ── */
  const groups = useMemo<ServiceRow[]>(() => {
    const map = new Map<string, { label: string; totalBruto: number; qtdNotas: number }>();

    for (const doc of filtrados) {
      const key   = serviceKey(doc);
      const label = serviceLabel(doc);
      const existing = map.get(key);
      if (existing) {
        existing.totalBruto += doc.valor_bruto;
        existing.qtdNotas   += 1;
      } else {
        map.set(key, { label, totalBruto: doc.valor_bruto, qtdNotas: 1 });
      }
    }

    const totalBrutoGeral = Array.from(map.values()).reduce((s, g) => s + g.totalBruto, 0);

    return Array.from(map.entries())
      .map(([key, g], i) => ({
        key,
        label: g.label,
        totalBruto: g.totalBruto,
        qtdNotas: g.qtdNotas,
        ticketMedio: g.qtdNotas > 0 ? g.totalBruto / g.qtdNotas : 0,
        color: SERVICE_PALETTE[i % SERVICE_PALETTE.length],
        pct: totalBrutoGeral > 0 ? (g.totalBruto / totalBrutoGeral) * 100 : 0,
      }))
      .sort((a, b) => b.totalBruto - a.totalBruto);
  }, [filtrados]);

  /* ── Top 10 for bar charts ── */
  const top10Revenue = useMemo(() => groups.slice(0, 10), [groups]);
  const top10Count   = useMemo(
    () => [...groups].sort((a, b) => b.qtdNotas - a.qtdNotas).slice(0, 10),
    [groups]
  );
  const top10Ticket  = useMemo(
    () => [...groups].filter(g => g.qtdNotas > 0).sort((a, b) => b.ticketMedio - a.ticketMedio).slice(0, 10),
    [groups]
  );

  /* ── Donut: top 5 + Outros ── */
  const donutData = useMemo(() => {
    const TOP = 5;
    const top  = groups.slice(0, TOP);
    const rest = groups.slice(TOP);
    const outrosBruto = rest.reduce((s, g) => s + g.totalBruto, 0);
    const totalGeral  = groups.reduce((s, g) => s + g.totalBruto, 0);
    const result = top.map((g, i) => ({
      ...g,
      fill: SERVICE_PALETTE[i],
      pct: totalGeral > 0 ? (g.totalBruto / totalGeral) * 100 : 0,
    }));
    if (outrosBruto > 0) {
      result.push({
        key: "__outros__",
        label: "Outros",
        totalBruto: outrosBruto,
        qtdNotas: rest.reduce((s, g) => s + g.qtdNotas, 0),
        ticketMedio: 0,
        color: "#94A3B8",
        fill: "#94A3B8",
        pct: totalGeral > 0 ? (outrosBruto / totalGeral) * 100 : 0,
      });
    }
    return result;
  }, [groups]);

  const totalBrutoGeral = useMemo(
    () => groups.reduce((s, g) => s + g.totalBruto, 0),
    [groups]
  );

  /* ── Abbreviated labels for X-axis ── */
  const abbrev = (label: string, max = 16) =>
    label.length > max ? label.slice(0, max) + "…" : label;

  /* ── Empty guard ── */
  if (filtrados.length === 0) {
    return (
      <div className="chart-card">
        <SectionHeader
          title="Análise por Serviço"
          subtitle="Nenhuma nota no recorte selecionado"
          accentColor="#2563EB"
        />
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Ajuste os filtros para visualizar os dados por serviço.
        </div>
      </div>
    );
  }

  /* ── No service data warning ── */
  const hasServiceData = groups.some((g) => g.key !== "Sem classificação");

  return (
    <div className="space-y-4">
      {/* ── Section title banner ── */}
      <div
        className="rounded-xl border border-border px-5 py-3.5 flex items-center gap-3"
        style={{ background: "var(--color-card)" }}
      >
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.546 0.225 264 / 12%)" }}
        >
          <Tag className="h-4.5 w-4.5" style={{ color: "#2563EB" }} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-foreground tracking-tight">
            Análise por Serviço
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {groups.length} tipo{groups.length !== 1 ? "s" : ""} de serviço ·{" "}
            {filtrados.length} nota{filtrados.length !== 1 ? "s" : ""} ·{" "}
            {fmtBRLCompact(totalBrutoGeral)} em faturamento bruto
          </p>
        </div>
        {!hasServiceData && (
          <span
            className="ml-auto text-[10px] px-2 py-1 rounded-full font-medium"
            style={{
              background: "oklch(0.7 0.14 80 / 15%)",
              color: "oklch(0.55 0.14 80)",
            }}
          >
            XMLs sem ItemListaServico — reimporte para ver classificação
          </span>
        )}
      </div>

      {/* ── ROW A: Faturamento (full width) ── */}
      <div className="chart-card">
        <SectionHeader
          title="Faturamento por Tipo de Serviço"
          subtitle={`Top ${Math.min(top10Revenue.length, 10)} serviços por valor bruto`}
          accentColor="#2563EB"
        />
        {top10Revenue.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(220, Math.min(top10Revenue.length * 44 + 40, 480))}
          >
            <BarChart
              data={top10Revenue}
              layout="vertical"
              margin={{ left: 8, right: 100, top: 4, bottom: 4 }}
              onMouseLeave={() => setHighlightKey(null)}
              onClick={(e) => {
                const entry = e?.activePayload?.[0]?.payload as ServiceRow | undefined;
                if (entry && onServiceDrillDown) {
                  onServiceDrillDown(entry.key, entry.label);
                }
              }}
              className={onServiceDrillDown ? "cursor-pointer" : ""}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={axGrid} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => fmtBRLCompact(Number(v))}
                tick={axTick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fontSize: 11, fill: "oklch(0.51 0.046 257)" }}
                width={200}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => abbrev(v, 32)}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "oklch(0.51 0.046 257 / 6%)" }} />
              <Bar
                dataKey="totalBruto"
                name="Faturamento Bruto"
                radius={[0, 6, 6, 0]}
                onMouseEnter={(data) => setHighlightKey(data.key)}
                label={{
                  position: "right",
                  formatter: (v: number) => fmtBRLCompact(v),
                  fontSize: 10,
                  fill: "oklch(0.51 0.046 257)",
                }}
              >
                {top10Revenue.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      highlightKey === null || highlightKey === entry.key
                        ? entry.color
                        : `${entry.color}66`
                    }
                    strokeWidth={0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── ROW B: Count + Ticket ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Chart 2 — Quantidade de Notas */}
        <div className="chart-card">
          <SectionHeader
            title="Quantidade de Notas por Serviço"
            subtitle="Top 10 serviços por volume de notas emitidas"
            accentColor="#14B8A6"
          />
          {top10Count.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={top10Count}
                margin={{ left: 0, right: 8, top: 8, bottom: 56 }}
                onClick={(e) => {
                  const entry = e?.activePayload?.[0]?.payload as ServiceRow | undefined;
                  if (entry && onServiceDrillDown) {
                    onServiceDrillDown(entry.key, entry.label);
                  }
                }}
                className={onServiceDrillDown ? "cursor-pointer" : ""}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "oklch(0.51 0.046 257)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  tickFormatter={(v: string) => abbrev(v, 14)}
                />
                <YAxis
                  tick={axTick}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  allowDecimals={false}
                />
                <Tooltip content={<CountTooltip />} cursor={{ fill: "oklch(0.51 0.046 257 / 6%)" }} />
                <Bar
                  dataKey="qtdNotas"
                  name="Qtd. Notas"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  label={{
                    position: "top",
                    fontSize: 9,
                    fill: "oklch(0.51 0.046 257)",
                    formatter: (v: number) => v,
                  }}
                >
                  {top10Count.map((entry) => (
                    <Cell key={entry.key} fill={`#14B8A6cc`} strokeWidth={0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3 — Ticket Médio */}
        <div className="chart-card">
          <SectionHeader
            title="Ticket Médio por Serviço"
            subtitle="Faturamento bruto ÷ quantidade de notas"
            accentColor="#F59E0B"
          />
          {top10Ticket.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={top10Ticket}
                margin={{ left: 0, right: 8, top: 8, bottom: 56 }}
                onClick={(e) => {
                  const entry = e?.activePayload?.[0]?.payload as ServiceRow | undefined;
                  if (entry && onServiceDrillDown) {
                    onServiceDrillDown(entry.key, entry.label);
                  }
                }}
                className={onServiceDrillDown ? "cursor-pointer" : ""}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "oklch(0.51 0.046 257)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  tickFormatter={(v: string) => abbrev(v, 14)}
                />
                <YAxis
                  tickFormatter={(v) => fmtBRLCompact(Number(v))}
                  tick={axTick}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<TicketTooltip />} cursor={{ fill: "oklch(0.51 0.046 257 / 6%)" }} />
                <Bar
                  dataKey="ticketMedio"
                  name="Ticket Médio"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  label={{
                    position: "top",
                    fontSize: 9,
                    fill: "oklch(0.51 0.046 257)",
                    formatter: (v: number) => fmtBRLCompact(v),
                  }}
                >
                  {top10Ticket.map((entry) => (
                    <Cell key={entry.key} fill={`#F59E0Bcc`} strokeWidth={0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── ROW C: Rosca de Participação (full width, centered) ── */}
      <div className="chart-card">
        <SectionHeader
          title="Participação dos Serviços no Faturamento"
          subtitle="Top 5 serviços + Outros"
          accentColor="#7C3AED"
          hint="Top 5 + Outros"
        />
        {donutData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-6 py-2">
            {/* Donut */}
            <div className="shrink-0" style={{ width: 280, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {donutData.map((d, i) => (
                      <radialGradient key={i} id={`svc-grad-${i}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={d.fill} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={d.fill} stopOpacity={0.6} />
                      </radialGradient>
                    ))}
                  </defs>
                  <Pie
                    data={donutData}
                    dataKey="totalBruto"
                    nameKey="label"
                    innerRadius={72}
                    outerRadius={108}
                    paddingAngle={2}
                    strokeWidth={0}
                    onClick={(entry) => {
                      if (entry && entry.key !== "__outros__" && onServiceDrillDown) {
                        onServiceDrillDown(entry.key, entry.label);
                      }
                    }}
                    className={onServiceDrillDown ? "cursor-pointer" : ""}
                  >
                    {donutData.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={`url(#svc-grad-${i})`}
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                  {/* Center label */}
                  <text
                    x="50%"
                    y="46%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--color-foreground)"
                    fontSize={15}
                    fontWeight={700}
                  >
                    {fmtBRLCompact(totalBrutoGeral)}
                  </text>
                  <text
                    x="50%"
                    y="57%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--color-muted-foreground)"
                    fontSize={9}
                  >
                    faturamento bruto
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend list */}
            <div className="flex-1 w-full space-y-2">
              {donutData.map((d) => (
                <div
                  key={d.key}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 ${
                    d.key !== "__outros__" && onServiceDrillDown ? "cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (d.key !== "__outros__" && onServiceDrillDown) {
                      onServiceDrillDown(d.key, d.label);
                    }
                  }}
                >
                  {/* Color swatch */}
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: d.fill }}
                  />
                  {/* Label */}
                  <span
                    className="flex-1 text-[12px] text-muted-foreground truncate"
                    title={d.label}
                  >
                    {d.label}
                  </span>
                  {/* Bruto */}
                  <span className="text-[12px] font-semibold text-foreground shrink-0">
                    {fmtBRLCompact(d.totalBruto)}
                  </span>
                  {/* Pct bar */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 72, background: "var(--color-border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(d.pct, 100)}%`, background: d.fill }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-foreground w-10 text-right">
                      {fmtPct(d.pct)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
