import { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Building2,
  Tag, Receipt, XCircle, ChevronDown, ChevronUp, Lightbulb,
  Info,
} from "lucide-react";
import type { FiscalDocument } from "@/lib/db";

/* ─── Types ─────────────────────────────────────────────────────────── */

type Severity = "danger" | "warning" | "info" | "success";

interface Insight {
  id: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  value?: string;
  /** Optional: opens drill-down when provided */
  onDetail?: () => void;
}

/* ─── Formatters ─────────────────────────────────────────────────────── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/* ─── Service key helper (must match ServiceAnalysis) ─────────────────── */
function docServiceKey(doc: FiscalDocument): string {
  return (
    doc.item_lista_servico?.trim() ||
    doc.codigo_servico?.trim() ||
    (doc.descricao_servico?.trim()
      ? doc.descricao_servico.trim().slice(0, 40)
      : "") ||
    "Sem classificação"
  );
}
function docServiceLabel(doc: FiscalDocument): string {
  const code = doc.item_lista_servico?.trim() || doc.codigo_servico?.trim() || "";
  const desc = doc.descricao_servico?.trim() || "";
  if (code && desc) return `${code} — ${desc.slice(0, 40)}`;
  if (code) return code;
  if (desc) return desc.slice(0, 45);
  return "Sem classificação";
}

/* ─── Previous-period helper ──────────────────────────────────────────── */
function buildPrevDocs(
  activeDocs: FiscalDocument[],
  allActiveDocs: FiscalDocument[]
): FiscalDocument[] {
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
    return allActiveDocs.filter((d) => d.data_competencia?.startsWith(prevYM));
  }

  const [minY, minM] = minYM.split("-").map(Number);
  const [maxY, maxM] = maxYM.split("-").map(Number);
  const prevMinYM = `${minY - 1}-${String(minM).padStart(2, "0")}`;
  const prevMaxYM = `${maxY - 1}-${String(maxM).padStart(2, "0")}`;

  return allActiveDocs.filter((d) => {
    const ym = d.data_competencia?.slice(0, 7) ?? "";
    return ym >= prevMinYM && ym <= prevMaxYM;
  });
}

/* ─── Insight engine ──────────────────────────────────────────────────── */
function computeInsights(
  activeDocs: FiscalDocument[],
  allDocs: FiscalDocument[],
  filteredDocs: FiscalDocument[],
  cnpjGrupoSet: Set<string>,
  openDrillDown?: (title: string, type: any) => void
): Insight[] {
  const insights: Insight[] = [];

  if (activeDocs.length === 0) return insights;

  const allActiveDocs = allDocs.filter((d) => d.status_manual !== "Cancelado");
  const prevDocs = buildPrevDocs(activeDocs, allActiveDocs);

  const totalBruto = activeDocs.reduce((s, d) => s + d.valor_bruto, 0);
  const totalRetido = activeDocs.reduce((s, d) => s + d.valor_retido, 0);
  const prevBruto = prevDocs.reduce((s, d) => s + d.valor_bruto, 0);
  const prevRetido = prevDocs.reduce((s, d) => s + d.valor_retido, 0);

  /* 1 — Retenções cresceram >20% */
  if (prevRetido > 0 && totalBruto > 0) {
    const retPct = totalRetido / totalBruto;
    const prevRetPct = prevBruto > 0 ? prevRetido / prevBruto : 0;
    const delta = prevRetPct > 0 ? ((retPct - prevRetPct) / prevRetPct) * 100 : 0;
    if (delta > 20) {
      insights.push({
        id: "retencoes-crescimento",
        severity: "warning",
        icon: TrendingUp,
        title: "Retenções acima do esperado",
        description: `As retenções cresceram ${delta.toFixed(1)}% em relação ao período anterior (${fmtBRLCompact(prevRetido)} → ${fmtBRLCompact(totalRetido)}). Verifique alterações em alíquotas ou novos prestadores.`,
        value: fmtPct(delta),
        onDetail: openDrillDown
          ? () => openDrillDown("Retenções — Período Atual", { type: "all" })
          : undefined,
      });
    }
  }

  /* 2 — Intercompany >30% do faturamento */
  const icBruto = activeDocs
    .filter((d) => cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador))
    .reduce((s, d) => s + d.valor_bruto, 0);
  const icPct = totalBruto > 0 ? (icBruto / totalBruto) * 100 : 0;
  if (icPct > 30) {
    insights.push({
      id: "intercompany-concentrado",
      severity: icPct > 50 ? "danger" : "warning",
      icon: Building2,
      title: "Alta concentração Intercompany",
      description: `${icPct.toFixed(1)}% do faturamento bruto (${fmtBRLCompact(icBruto)}) são operações entre empresas do mesmo grupo. Avalie a sustentabilidade da receita externa.`,
      value: `${icPct.toFixed(1)}%`,
      onDetail: openDrillDown
        ? () => openDrillDown("Operações Intercompany", { type: "intercompany" })
        : undefined,
    });
  }

  /* 3 — Empresa >50% do faturamento */
  const byCompany: Record<string, { nome: string; bruto: number }> = {};
  for (const d of activeDocs) {
    if (!byCompany[d.cnpj_prestador]) {
      byCompany[d.cnpj_prestador] = { nome: d.nome_prestador || d.cnpj_prestador, bruto: 0 };
    }
    byCompany[d.cnpj_prestador].bruto += d.valor_bruto;
  }
  for (const [cnpj, info] of Object.entries(byCompany)) {
    const pct = totalBruto > 0 ? (info.bruto / totalBruto) * 100 : 0;
    if (pct > 50) {
      insights.push({
        id: `empresa-concentrada-${cnpj}`,
        severity: "danger",
        icon: AlertTriangle,
        title: "Concentração de faturamento por empresa",
        description: `"${info.nome}" representa ${pct.toFixed(1)}% do faturamento total (${fmtBRLCompact(info.bruto)}). Alta dependência de um único prestador eleva risco operacional.`,
        value: `${pct.toFixed(1)}%`,
        onDetail: openDrillDown
          ? () => openDrillDown(`Prestador — ${info.nome}`, { type: "prestador", cnpj })
          : undefined,
      });
      break; // only first dominant company
    }
  }

  /* 4 — Serviço caiu >15% */
  if (prevDocs.length > 0) {
    const svcCurr: Record<string, { label: string; bruto: number }> = {};
    const svcPrev: Record<string, { label: string; bruto: number }> = {};
    for (const d of activeDocs) {
      const k = docServiceKey(d);
      const l = docServiceLabel(d);
      if (!svcCurr[k]) svcCurr[k] = { label: l, bruto: 0 };
      svcCurr[k].bruto += d.valor_bruto;
    }
    for (const d of prevDocs) {
      const k = docServiceKey(d);
      const l = docServiceLabel(d);
      if (!svcPrev[k]) svcPrev[k] = { label: l, bruto: 0 };
      svcPrev[k].bruto += d.valor_bruto;
    }
    let biggestDrop: { key: string; label: string; delta: number; curr: number; prev: number } | null = null;
    for (const [k, curr] of Object.entries(svcCurr)) {
      const prev = svcPrev[k];
      if (!prev || prev.bruto === 0) continue;
      const delta = ((curr.bruto - prev.bruto) / prev.bruto) * 100;
      if (delta < -15) {
        if (!biggestDrop || delta < biggestDrop.delta) {
          biggestDrop = { key: k, label: curr.label, delta, curr: curr.bruto, prev: prev.bruto };
        }
      }
    }
    if (biggestDrop) {
      insights.push({
        id: "servico-queda",
        severity: "warning",
        icon: TrendingDown,
        title: "Queda de faturamento por serviço",
        description: `O serviço "${biggestDrop.label}" caiu ${Math.abs(biggestDrop.delta).toFixed(1)}% (${fmtBRLCompact(biggestDrop.prev)} → ${fmtBRLCompact(biggestDrop.curr)}). Verifique cancelamentos ou migração de demanda.`,
        value: fmtPct(biggestDrop.delta),
        onDetail: openDrillDown
          ? () =>
              openDrillDown(`Serviço — ${biggestDrop!.label}`, {
                type: "servico",
                serviceKey: biggestDrop!.key,
                serviceLabel: biggestDrop!.label,
              })
          : undefined,
      });
    }
  }

  /* 5 — Ticket médio aumentou significativamente (>15%) */
  if (prevDocs.length > 0) {
    const currTicket = activeDocs.length > 0 ? totalBruto / activeDocs.length : 0;
    const prevTicket = prevDocs.length > 0 ? prevBruto / prevDocs.length : 0;
    if (prevTicket > 0) {
      const delta = ((currTicket - prevTicket) / prevTicket) * 100;
      if (Math.abs(delta) > 15) {
        insights.push({
          id: "ticket-medio-variacao",
          severity: delta > 0 ? "success" : "warning",
          icon: Receipt,
          title: delta > 0 ? "Ticket médio em alta" : "Ticket médio em queda",
          description: `O ticket médio ${delta > 0 ? "subiu" : "caiu"} ${Math.abs(delta).toFixed(1)}% (${fmtBRLCompact(prevTicket)} → ${fmtBRLCompact(currTicket)}). ${delta > 0 ? "Pode indicar valorização dos serviços ou mix de produtos mais premium." : "Verifique descontos, mix de serviços ou aumento de notas de baixo valor."}`,
          value: fmtPct(delta),
          onDetail: openDrillDown
            ? () => openDrillDown("Todas as notas — Ticket Médio", { type: "all" })
            : undefined,
        });
      }
    }
  }

  /* 6 — Cancelamentos relevantes no período */
  const canceladas = filteredDocs.filter((d) => d.status_manual === "Cancelado").length;
  const totalNotas = filteredDocs.length;
  const cancelPct = totalNotas > 0 ? (canceladas / totalNotas) * 100 : 0;
  if (cancelPct > 5 && canceladas > 0) {
    insights.push({
      id: "cancelamentos-relevantes",
      severity: cancelPct > 15 ? "danger" : "warning",
      icon: XCircle,
      title: "Volume relevante de cancelamentos",
      description: `${canceladas} nota${canceladas !== 1 ? "s" : ""} cancelada${canceladas !== 1 ? "s" : ""} no período (${cancelPct.toFixed(1)}% do total). Cancelamentos elevados impactam indicadores de performance e podem sinalizar problemas operacionais.`,
      value: `${canceladas} (${cancelPct.toFixed(1)}%)`,
    });
  }

  return insights;
}

/* ─── Severity Config ─────────────────────────────────────────────────── */
const SEVERITY_CONFIG: Record<
  Severity,
  { bg: string; border: string; iconColor: string; badge: string; badgeBg: string; label: string }
> = {
  danger: {
    bg: "oklch(0.97 0.015 20)",
    border: "#EF4444",
    iconColor: "#EF4444",
    badge: "#EF4444",
    badgeBg: "oklch(0.95 0.04 20)",
    label: "Crítico",
  },
  warning: {
    bg: "oklch(0.98 0.015 75)",
    border: "#F59E0B",
    iconColor: "#F59E0B",
    badge: "#F59E0B",
    badgeBg: "oklch(0.96 0.04 75)",
    label: "Atenção",
  },
  info: {
    bg: "oklch(0.97 0.015 260)",
    border: "#2563EB",
    iconColor: "#2563EB",
    badge: "#2563EB",
    badgeBg: "oklch(0.95 0.04 260)",
    label: "Info",
  },
  success: {
    bg: "oklch(0.97 0.015 145)",
    border: "#10B981",
    iconColor: "#10B981",
    badge: "#10B981",
    badgeBg: "oklch(0.95 0.04 145)",
    label: "Positivo",
  },
};

/* ─── Single Alert Card ───────────────────────────────────────────────── */
function InsightCard({ insight }: { insight: Insight }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  return (
    <div
      className="insight-alert"
      style={{
        borderLeftColor: cfg.border,
        background: cfg.bg,
      }}
    >
      {/* Icon */}
      <div
        className="insight-alert-icon"
        style={{ background: `${cfg.border}18`, color: cfg.iconColor }}
      >
        <insight.icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-foreground">{insight.title}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: cfg.badgeBg, color: cfg.badge }}
          >
            {cfg.label}
          </span>
          {insight.value && (
            <span
              className="text-[11px] font-bold ml-auto shrink-0"
              style={{ color: cfg.border }}
            >
              {insight.value}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
      </div>

      {/* Detail button */}
      {insight.onDetail && (
        <button
          onClick={insight.onDetail}
          className="insight-detail-btn shrink-0"
          style={{ color: cfg.border, borderColor: `${cfg.border}40` }}
        >
          Ver notas
        </button>
      )}
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────── */
interface AutoInsightsProps {
  /** Active docs (cancelled excluded) already filtered by global filters */
  activeDocs: FiscalDocument[];
  /** All DB docs (for building previous period) */
  allDocs: FiscalDocument[];
  /** All filtered docs including cancelled (for cancelled count) */
  filteredDocs: FiscalDocument[];
  cnpjGrupoSet: Set<string>;
  /** Open drill-down modal with given config */
  openDrillDown: (title: string, filter: any) => void;
}

/* ─── Main Export ─────────────────────────────────────────────────────── */
export function AutoInsights({
  activeDocs,
  allDocs,
  filteredDocs,
  cnpjGrupoSet,
  openDrillDown,
}: AutoInsightsProps) {
  const [collapsed, setCollapsed] = useState(false);

  const insights = useMemo(
    () =>
      computeInsights(activeDocs, allDocs, filteredDocs, cnpjGrupoSet, openDrillDown),
    // openDrillDown is stable from store, safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDocs, allDocs, filteredDocs, cnpjGrupoSet]
  );

  if (insights.length === 0) return null;

  const dangerCount = insights.filter((i) => i.severity === "danger").length;
  const warnCount = insights.filter((i) => i.severity === "warning").length;

  return (
    <div className="insights-panel">
      {/* Header */}
      <button
        className="insights-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2.5">
          <div className="insights-header-icon">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-[13px] font-bold text-foreground">Insights Automáticos</div>
            <div className="text-[11px] text-muted-foreground">
              {insights.length} alerta{insights.length !== 1 ? "s" : ""} detectado{insights.length !== 1 ? "s" : ""} no período
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {dangerCount > 0 && (
            <span className="insights-badge insights-badge--danger">
              {dangerCount} crítico{dangerCount !== 1 ? "s" : ""}
            </span>
          )}
          {warnCount > 0 && (
            <span className="insights-badge insights-badge--warning">
              {warnCount} atenção
            </span>
          )}
          <div className="insights-chevron">
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="insights-body">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
          <div className="insights-footer">
            <Info className="h-3 w-3 shrink-0" />
            Insights calculados automaticamente com base nos dados filtrados. Período anterior usado como referência para comparativos.
          </div>
        </div>
      )}
    </div>
  );
}
