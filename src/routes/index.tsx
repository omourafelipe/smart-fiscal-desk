import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell, Area, AreaChart, LineChart, Line,
} from "recharts";
import {
  Upload, Loader2, FileText, Building2,
  BarChart3, AlertCircle, CloudUpload, Filter, MonitorPlay,
} from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { importFiles, type ImportSummary } from "@/lib/fiscal/pipeline";
import { useFiscalStore, type DrillDownFilter } from "@/store/useFiscalStore";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DrillDownModal } from "@/components/DrillDownModal";
import { ExecutiveKpis } from "@/components/ExecutiveKpis";
import { ServiceAnalysis } from "@/components/ServiceAnalysis";
import { AutoInsights } from "@/components/AutoInsights";
import { ExportMenu } from "@/components/ExportMenu";
import { FavoriteFiltersPanel } from "@/components/FavoriteFiltersPanel";
import { PresentationMode, FullscreenButton } from "@/components/PresentationMode";

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

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const MESES = [
  { v: "01", l: "Janeiro" }, { v: "02", l: "Fevereiro" }, { v: "03", l: "Março" },
  { v: "04", l: "Abril" }, { v: "05", l: "Maio" }, { v: "06", l: "Junho" },
  { v: "07", l: "Julho" }, { v: "08", l: "Agosto" }, { v: "09", l: "Setembro" },
  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
];

const NOME_MES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

/* ─── Chart palette ──────────────────────────────────────────── */
const C = {
  blue:    "#2563EB",
  teal:    "#14B8A6",
  amber:   "#F59E0B",
  red:     "#EF4444",
  purple:  "#7C3AED",
  green:   "#10B981",
  orange:  "#F97316",
  pink:    "#EC4899",
  muted:   "#94A3B8",
};

const COMPANY_PALETTE = [C.blue, C.teal, C.amber, C.purple, C.green, C.orange, C.pink];

/* ─── Helpers ────────────────────────────────────────────────── */

/** Builds last 12 calendar months (MM/YYYY display labels) anchored to the latest doc */
function buildLast12MonthLabels(latestYm: string): Array<{ ym: string; label: string }> {
  const anchor = latestYm || new Date().toISOString().slice(0, 7);
  const [yStr, mStr] = anchor.split("-");
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  const result: Array<{ ym: string; label: string }> = [];
  for (let i = 11; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) { mm += 12; yy--; }
    const ymKey = `${yy}-${String(mm).padStart(2, "0")}`;
    const mmStr = String(mm).padStart(2, "0");
    result.push({ ym: ymKey, label: `${NOME_MES[mmStr]}/${String(yy).slice(2)}` });
  }
  return result;
}

/* ─── Skeleton loader ────────────────────────────────────────── */
function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className="chart-card" aria-hidden="true">
      <div className="skeleton h-4 w-48 rounded mb-4" />
      <div className="skeleton rounded-lg" style={{ height }} />
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────── */
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="empty-state-icon">
        <div
          className="h-20 w-20 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, oklch(0.546 0.225 264 / 12%), oklch(0.7 0.14 192 / 12%))",
            border: "1px solid oklch(0.546 0.225 264 / 20%)",
          }}
        >
          <BarChart3 className="h-9 w-9" style={{ color: C.blue }} />
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">Nenhuma nota importada</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Importe arquivos XML ou ZIP de NFS-e para visualizar os indicadores executivos.
        </p>
      </div>
      <Button
        id="empty-state-upload-btn"
        onClick={onUpload}
        className="gap-2 h-9"
        style={{ background: C.blue }}
      >
        <CloudUpload className="h-4 w-4" />
        Importar NFS-e
      </Button>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────── */
function SectionHeader({
  title,
  subtitle,
  accentColor,
  hint,
}: {
  title: string;
  subtitle?: string;
  accentColor?: string;
  hint?: string;
}) {
  return (
    <div className="chart-section-header">
      {accentColor && (
        <div className="chart-accent-bar" style={{ background: accentColor }} />
      )}
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

/* ─── Custom Tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-name">
            <span className="chart-tooltip-dot" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="chart-tooltip-value">
            {formatter ? formatter(p.value, p.name) : fmtBRL(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{p.name}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-name">
          <span className="chart-tooltip-dot" style={{ background: p.payload.fill || p.payload.color }} />
          Faturamento
        </span>
        <span className="chart-tooltip-value">{fmtBRL(Number(p.value))}</span>
      </div>
      {p.payload.pct !== undefined && (
        <div className="chart-tooltip-row">
          <span className="chart-tooltip-name" style={{ color: "var(--color-muted-foreground)" }}>Participação</span>
          <span className="chart-tooltip-value" style={{ color: "var(--color-muted-foreground)" }}>
            {fmtPct(p.payload.pct)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Donut Center SVG Label (rendered as Recharts customized label) ── */
function DonutLabel({ viewBox, total, label }: { viewBox?: { cx: number; cy: number }; total: string; label: string }) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;
  return (
    <>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-foreground)" fontSize={14} fontWeight={700}>
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={9}>
        {label}
      </text>
    </>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────── */
function Dashboard() {
  const {
    mesFiltro, anoFiltro, setMesFiltro, setAnoFiltro,
    empresaFiltro, statusFiltro, operacaoFiltro,
    setEmpresaFiltro, setStatusFiltro, setOperacaoFiltro,
    resetFilters,
    drillDown, openDrillDown, closeDrillDown,
    presentationMode, setPresentationMode,
  } = useFiscalStore();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── Keyboard: F = fullscreen ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  /** Map cnpj → name from groupCnpjs registry */
  const cnpjNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (grupoCnpjs ?? []).forEach((g) => {
      if (g.cnpj && g.nome) m[g.cnpj] = g.nome;
    });
    return m;
  }, [grupoCnpjs]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    (docs ?? []).forEach((d) => {
      if (d.data_competencia) set.add(d.data_competencia.slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [docs]);

  const filtrados = useMemo(() => {
    return (docs ?? []).filter((d) => {
      if (d.data_competencia) {
        const [a, m] = d.data_competencia.split("-");
        if (anoFiltro && a !== anoFiltro) return false;
        if (mesFiltro && m !== mesFiltro) return false;
      } else if (mesFiltro || anoFiltro) {
        return false;
      }
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;
      const isIntercompany = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIntercompany) return false;
      if (operacaoFiltro === "Externas" && isIntercompany) return false;
      return true;
    });
  }, [docs, mesFiltro, anoFiltro, empresaFiltro, statusFiltro, operacaoFiltro, cnpjGrupoSet]);

  const ativos = useMemo(
    () => (statusFiltro === "todos" ? filtrados.filter((d) => d.status_manual === "Ativo") : filtrados),
    [filtrados, statusFiltro]
  );

  const intercompanyDocs = useMemo(
    () =>
      ativos.filter(
        (d) =>
          d.cnpj_prestador &&
          d.cnpj_tomador &&
          cnpjGrupoSet.has(d.cnpj_prestador) &&
          cnpjGrupoSet.has(d.cnpj_tomador)
      ),
    [ativos, cnpjGrupoSet]
  );

  const totalBruto = useMemo(() => ativos.reduce((s, d) => s + d.valor_bruto, 0), [ativos]);
  const totalRetido = useMemo(() => ativos.reduce((s, d) => s + d.valor_retido, 0), [ativos]);
  const totalLiquido = useMemo(() => ativos.reduce((s, d) => s + d.valor_liquido, 0), [ativos]);
  const intercompanyBruto = useMemo(() => intercompanyDocs.reduce((s, d) => s + d.valor_bruto, 0), [intercompanyDocs]);
  const externoBruto = useMemo(() => totalBruto - intercompanyBruto, [totalBruto, intercompanyBruto]);

  /* ── Export KPIs ── */
  const exportKpis = useMemo(() => ({
    bruto: totalBruto,
    liquido: totalLiquido,
    retido: totalRetido,
    intercompany: intercompanyBruto,
    qtd: ativos.length,
    ticketMedio: ativos.length > 0 ? totalBruto / ativos.length : 0,
  }), [totalBruto, totalLiquido, totalRetido, intercompanyBruto, ativos.length]);

  /* ── Last 12 months anchor ── */
  const latestYm = useMemo(() => {
    return (docs ?? [])
      .map((d) => d.data_competencia?.slice(0, 7) ?? "")
      .filter(Boolean)
      .reduce((a, b) => (a > b ? a : b), "");
  }, [docs]);

  const last12Entries = useMemo(() => buildLast12MonthLabels(latestYm), [latestYm]);

  /* ── Chart 1 & 2: Revenue + Retention evolution (12 months fixed) ── */
  const evolutionData = useMemo(() => {
    const map: Record<string, { bruto: number; liquido: number; retido: number }> = {};
    last12Entries.forEach(({ ym }) => {
      map[ym] = { bruto: 0, liquido: 0, retido: 0 };
    });
    filtrados.forEach((d) => {
      const ym = d.data_competencia?.slice(0, 7) ?? "";
      if (!map[ym]) return;
      map[ym].bruto += d.valor_bruto;
      map[ym].liquido += d.valor_liquido;
      map[ym].retido += d.valor_retido;
    });
    return last12Entries.map(({ ym, label }) => ({
      ym,
      name: label,
      bruto: map[ym].bruto,
      liquido: map[ym].liquido,
      retido: map[ym].retido,
    }));
  }, [filtrados, last12Entries]);

  /* ── Chart 3: Company ranking (name-aware, top 10) ── */
  const rankingData = useMemo(() => {
    const map: Record<string, { nome: string; cnpj: string; bruto: number }> = {};
    filtrados.forEach((d) => {
      const key = d.cnpj_prestador || "";
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          cnpj: key,
          nome: d.nome_prestador || cnpjNameMap[key] || fmtCnpj(key),
          bruto: 0,
        };
      }
      map[key].bruto += d.valor_bruto;
    });
    return Object.values(map)
      .sort((a, b) => b.bruto - a.bruto)
      .slice(0, 10);
  }, [filtrados, cnpjNameMap]);

  /* ── Chart 4: Consolidated participation by company (top 6 + Outros) ── */
  const consolidadoData = useMemo(() => {
    const map: Record<string, { nome: string; cnpj: string; bruto: number }> = {};
    ativos.forEach((d) => {
      const key = d.cnpj_prestador || "";
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          cnpj: key,
          nome: d.nome_prestador || cnpjNameMap[key] || fmtCnpj(key),
          bruto: 0,
        };
      }
      map[key].bruto += d.valor_bruto;
    });
    const sorted = Object.values(map).sort((a, b) => b.bruto - a.bruto);
    const TOP = 6;
    const top = sorted.slice(0, TOP);
    const rest = sorted.slice(TOP);
    const outrosBruto = rest.reduce((s, r) => s + r.bruto, 0);
    const result = top.map((e, i) => ({
      ...e,
      color: COMPANY_PALETTE[i],
      pct: totalBruto > 0 ? (e.bruto / totalBruto) * 100 : 0,
    }));
    if (outrosBruto > 0) {
      result.push({
        cnpj: "__outros__",
        nome: "Outros",
        bruto: outrosBruto,
        color: C.muted,
        pct: totalBruto > 0 ? (outrosBruto / totalBruto) * 100 : 0,
      });
    }
    return result;
  }, [ativos, totalBruto, cnpjNameMap]);

  /* ── Chart 5: Intercompany × Externo evolution (12 months grouped) ── */
  const icEvolucaoData = useMemo(() => {
    const map: Record<string, { intercompany: number; externo: number }> = {};
    last12Entries.forEach(({ ym }) => {
      map[ym] = { intercompany: 0, externo: 0 };
    });
    filtrados.forEach((d) => {
      const ym = d.data_competencia?.slice(0, 7) ?? "";
      if (!map[ym]) return;
      const isIC = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (isIC) {
        map[ym].intercompany += d.valor_bruto;
      } else {
        map[ym].externo += d.valor_bruto;
      }
    });
    return last12Entries.map(({ ym, label }) => ({
      name: label,
      Intercompany: map[ym].intercompany,
      Externo: map[ym].externo,
    }));
  }, [filtrados, last12Entries, cnpjGrupoSet]);

  /* ── Chart 6: Intercompany participation by company ── */
  const icParticipacaoData = useMemo(() => {
    const map: Record<string, { nome: string; cnpj: string; bruto: number }> = {};
    intercompanyDocs.forEach((d) => {
      const key = d.cnpj_prestador || "";
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          cnpj: key,
          nome: d.nome_prestador || cnpjNameMap[key] || fmtCnpj(key),
          bruto: 0,
        };
      }
      map[key].bruto += d.valor_bruto;
    });
    const sorted = Object.values(map).sort((a, b) => b.bruto - a.bruto);
    const TOP = 5;
    const top = sorted.slice(0, TOP);
    const rest = sorted.slice(TOP);
    const outrosBruto = rest.reduce((s, r) => s + r.bruto, 0);
    const result = top.map((e, i) => ({
      ...e,
      color: COMPANY_PALETTE[i],
      pct: intercompanyBruto > 0 ? (e.bruto / intercompanyBruto) * 100 : 0,
    }));
    if (outrosBruto > 0) {
      result.push({
        cnpj: "__outros__",
        nome: "Outros",
        bruto: outrosBruto,
        color: C.muted,
        pct: intercompanyBruto > 0 ? (outrosBruto / intercompanyBruto) * 100 : 0,
      });
    }
    return result;
  }, [intercompanyDocs, intercompanyBruto, cnpjNameMap]);

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
      setLastSummary(summary);
      toast.success(
        `Lote concluído: ${summary.importadas} importadas, ${summary.duplicadas} duplicadas, ${summary.erros} erros.`
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
  const periodoLabel = [mesSelecionado?.l, anoFiltro].filter(Boolean).join(" ") || "Todos os períodos";

  /* ─── Axis tick styles ── */
  const axTick = { fontSize: 10, fill: "oklch(0.51 0.046 257)" };
  const axGrid = "oklch(0.918 0.015 253)";

  return (
    <div
      className={`min-h-screen${presentationMode ? " presentation-active" : ""}`}
      style={{ background: "var(--color-background)" }}
    >
      {/* ── Presentation Mode Overlay ── */}
      {presentationMode && (
        <PresentationMode onExit={() => setPresentationMode(false)} />
      )}
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[1.6rem] font-bold tracking-tight text-foreground">
              {presentationMode ? "🎯 Cockpit Fiscal — Apresentação" : "Dashboard Fiscal"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {periodoLabel} · {ativos.length} nota{ativos.length !== 1 ? "s" : ""} ativa{ativos.length !== 1 ? "s" : ""}
              {cnpjGrupoSet.size > 0 && ` · ${cnpjGrupoSet.size} CNPJ${cnpjGrupoSet.size !== 1 ? "s" : ""} no grupo`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasData && (
              <>
                <ExportMenu
                  docs={ativos}
                  cnpjGrupoSet={cnpjGrupoSet}
                  filterLabels={{
                    periodo: periodoLabel,
                    empresa: cnpjNameMap[empresaFiltro] || (empresaFiltro ? empresaFiltro : "Consolidado do Grupo"),
                    status: statusFiltro === "todos" ? "Todos" : statusFiltro,
                    operacao: operacaoFiltro,
                  }}
                  kpis={exportKpis}
                />
                <button
                  id="presentation-mode-btn"
                  className={`fullscreen-btn${presentationMode ? " active" : ""}`}
                  onClick={() => setPresentationMode(!presentationMode)}
                  title={presentationMode ? "Sair do Modo Apresentação" : "Modo Apresentação"}
                >
                  <MonitorPlay className="h-4 w-4" />
                </button>
                <FullscreenButton />
              </>
            )}
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
              id="header-import-btn"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              variant="outline"
              className="gap-2 h-9 font-medium"
            >
              {importing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />
              }
              {importing ? "Importando..." : "Importar NFS-e"}
            </Button>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div
          className="rounded-xl border border-border p-3 flex flex-wrap items-center gap-3"
          style={{ background: "var(--color-card)", boxShadow: "0 1px 3px oklch(0 0 0 / 4%)" }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mr-1">
            Filtros
          </span>
          <FavoriteFiltersPanel />
          {/* Mês */}
          <Select value={mesFiltro || "__all__"} onValueChange={(v) => setMesFiltro(v === "__all__" ? "" : v)}>
            <SelectTrigger id="filter-mes" className="w-36 h-8 text-sm">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {MESES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Ano */}
          <Select value={anoFiltro || "__all__"} onValueChange={(v) => setAnoFiltro(v === "__all__" ? "" : v)}>
            <SelectTrigger id="filter-ano" className="w-28 h-8 text-sm">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Empresa */}
          <Select value={empresaFiltro || "__grupo__"} onValueChange={(v) => setEmpresaFiltro(v === "__grupo__" ? "" : v)}>
            <SelectTrigger id="filter-empresa" className="w-52 h-8 text-sm">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__grupo__">Consolidado do Grupo</SelectItem>
              {grupoCnpjs?.map((g) => (
                <SelectItem key={g.cnpj} value={g.cnpj}>
                  {g.nome || fmtCnpj(g.cnpj)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-5 w-px bg-border mx-0.5" />

          {/* Status */}
          <div className="filter-group">
            {(["todos", "Ativo", "Cancelado"] as const).map((s) => (
              <button
                key={s}
                id={`filter-status-${s}`}
                onClick={() => setStatusFiltro(s)}
                className={`filter-btn${statusFiltro === s ? " active" : ""}`}
              >
                {s === "todos" ? "Todos" : s}
              </button>
            ))}
          </div>

          {/* Operação */}
          <div className="filter-group">
            {(["Todas", "Externas", "Intercompany"] as const).map((op) => (
              <button
                key={op}
                id={`filter-op-${op}`}
                onClick={() => setOperacaoFiltro(op)}
                className={`filter-btn${operacaoFiltro === op ? " active" : ""}`}
              >
                {op}
              </button>
            ))}
          </div>

          {/* Clear empresa filter badge */}
          {empresaFiltro && (
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/8 hover:bg-primary/15 transition-colors"
              onClick={() => setEmpresaFiltro("")}
            >
              <Building2 className="h-3 w-3" />
              {cnpjNameMap[empresaFiltro] || fmtCnpj(empresaFiltro)}
              <span className="opacity-60">×</span>
            </button>
          )}
          {/* Reset all filters */}
          {(mesFiltro || anoFiltro || empresaFiltro || statusFiltro !== "Ativo" || operacaoFiltro !== "Todas") && (
            <button
              id="reset-filters-btn"
              className="text-[11px] font-medium px-2 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={resetFilters}
              title="Limpar todos os filtros"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* ── Upload Drop Zone ── */}
        {(importing || !hasData) && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
            }}
            className={`upload-zone${dragOver ? " drag-over" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${C.blue}18` }}
              >
                <CloudUpload className="h-5 w-5" style={{ color: C.blue }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground">Importar NFS-e Nacional</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Arraste arquivos <span className="font-mono">.xml</span> ou <span className="font-mono">.zip</span> aqui, ou clique para selecionar.
                </div>
              </div>
              <Button
                id="dropzone-import-btn"
                onClick={() => inputRef.current?.click()}
                disabled={importing}
                className="gap-2 shrink-0"
                style={{ background: C.blue, color: "#fff" }}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "Importando..." : "Selecionar arquivos"}
              </Button>
            </div>
            {importing && progress && progress.total > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Processando XMLs...</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full progress-bar-animated transition-all duration-300"
                    style={{
                      width: `${(progress.done / progress.total) * 100}%`,
                      background: `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
                    }}
                  />
                </div>
              </div>
            )}
            {lastSummary && !importing && (
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Último lote: <strong>{lastSummary.importadas}</strong> importadas,{" "}
                <strong>{lastSummary.duplicadas}</strong> duplicadas,{" "}
                <strong>{lastSummary.erros}</strong> erro(s).
              </div>
            )}
          </div>
        )}

        {/* ── Loading Skeletons ── */}
        {isLoading && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SkeletonChart />
              <SkeletonChart />
            </div>
            <SkeletonChart height={200} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SkeletonChart height={260} />
              <SkeletonChart height={260} />
              <SkeletonChart height={260} />
            </div>
          </>
        )}

        {/* ── Empty State ── */}
        {mounted && !isLoading && !hasData && (
          <div className="chart-card">
            <EmptyState onUpload={() => inputRef.current?.click()} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════════════════════ */}
        {mounted && hasData && (
          <>
            {/* ══ Auto Insights ══ */}
            <div data-slide-id="kpis">
            <AutoInsights
              activeDocs={ativos}
              allDocs={docs ?? []}
              filteredDocs={filtrados}
              cnpjGrupoSet={cnpjGrupoSet}
              openDrillDown={(title, filter) => openDrillDown({ title, filter })}
            />

            {/* ── Executive KPI Summary ── */}
            <ExecutiveKpis
              activeDocs={ativos}
              allDocs={docs ?? []}
              filteredDocs={filtrados}
              cnpjGrupoSet={cnpjGrupoSet}
              onKpiClick={(kpiId) => {
                const kpiDrillMap: Record<string, { title: string; filter: any }> = {
                  bruto:          { title: "Faturamento Bruto",   filter: { type: "all" } },
                  liquido:        { title: "Faturamento Líquido", filter: { type: "all" } },
                  retencoes:      { title: "Retenções",           filter: { type: "all" } },
                  intercompany:   { title: "Intercompany",        filter: { type: "intercompany" } },
                  "qtd-notas":    { title: "Qtd. de Notas",      filter: { type: "all" } },
                  "ticket-medio": { title: "Ticket Médio",        filter: { type: "all" } },
                };
                const cfg = kpiDrillMap[kpiId];
                if (cfg) openDrillDown(cfg);
              }}
            />
            </div>

            {/* ════════════════════════════════════════════════
                ROW 1 — Evolução Faturamento | Evolução Retenções
            ════════════════════════════════════════════════ */}
            <div data-slide-id="evolution" className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ── Chart 1: Evolução do Faturamento (Linha dupla) ── */}
              <div className="chart-card">
                <SectionHeader
                  title="Evolução do Faturamento"
                  subtitle="Bruto × Líquido — últimos 12 meses"
                  accentColor={C.blue}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={evolutionData}
                    onClick={(e) => {
                      if (e?.activePayload?.[0]?.payload?.ym) {
                        const ym = e.activePayload[0].payload.ym as string;
                        const [y, m] = ym.split("-");
                        openDrillDown({
                          title: `Faturamento — ${NOME_MES[m]}/${y}`,
                          filter: { type: "competencia", value: `${m}/${y}` },
                        });
                      }
                    }}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <defs>
                      <filter id="glow-blue">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                    <XAxis dataKey="name" tick={axTick} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => fmtBRLCompact(Number(v))}
                      tick={axTick}
                      width={68}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ stroke: "oklch(0.546 0.225 264 / 20%)", strokeWidth: 1 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="bruto"
                      name="Bruto"
                      stroke={C.blue}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: C.blue, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: C.blue, strokeWidth: 2, stroke: "#fff" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="liquido"
                      name="Líquido"
                      stroke={C.teal}
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: C.teal, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: C.teal, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ── Chart 2: Evolução das Retenções (Área) ── */}
              <div className="chart-card">
                <SectionHeader
                  title="Evolução das Retenções"
                  subtitle="Valor retido por competência — últimos 12 meses"
                  accentColor={C.amber}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={evolutionData}
                    onClick={(e) => {
                      if (e?.activePayload?.[0]?.payload?.ym) {
                        const ym = e.activePayload[0].payload.ym as string;
                        const [y, m] = ym.split("-");
                        openDrillDown({
                          title: `Retenções — ${NOME_MES[m]}/${y}`,
                          filter: { type: "competencia", value: `${m}/${y}` },
                        });
                      }
                    }}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradRetido" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.amber} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={C.amber} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                    <XAxis dataKey="name" tick={axTick} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => fmtBRLCompact(Number(v))}
                      tick={axTick}
                      width={68}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          formatter={(v: number, name: string) => {
                            const bruto = evolutionData.find(d => d.retido === v)?.bruto;
                            const pct = bruto && bruto > 0 ? ` (${fmtPct((v / bruto) * 100)} do bruto)` : "";
                            return `${fmtBRL(v)}${pct}`;
                          }}
                        />
                      }
                      cursor={{ stroke: `${C.amber}40`, strokeWidth: 1 }}
                    />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Area
                      type="monotone"
                      dataKey="retido"
                      name="Retenções"
                      stroke={C.amber}
                      strokeWidth={2.5}
                      fill="url(#gradRetido)"
                      dot={{ r: 3, fill: C.amber, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: C.amber, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ════════════════════════════════════════════════
                ROW 2 — Ranking de Empresas (full width)
            ════════════════════════════════════════════════ */}
            <div data-slide-id="ranking" className="chart-card">
              <SectionHeader
                title="Ranking de Empresas"
                subtitle={`Top ${Math.min(rankingData.length, 10)} prestadores por faturamento bruto`}
                accentColor={C.purple}
                hint="Clique para filtrar"
              />
              {rankingData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, Math.min(rankingData.length * 40 + 40, 400))}
                >
                  <BarChart
                    data={rankingData}
                    layout="vertical"
                    margin={{ left: 8, right: 80, top: 4, bottom: 4 }}
                    onClick={(e) => {
                      const cnpj = e?.activePayload?.[0]?.payload?.cnpj;
                      if (cnpj) {
                        // Click → set global empresa filter
                        setEmpresaFiltro(cnpj === empresaFiltro ? "" : cnpj);
                      }
                    }}
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
                      dataKey="nome"
                      type="category"
                      tick={{ fontSize: 11, fill: "oklch(0.51 0.046 257)" }}
                      width={160}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "…" : v}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="chart-tooltip">
                            <div className="chart-tooltip-label">{d.nome}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mb-1">{fmtCnpj(d.cnpj)}</div>
                            <div className="chart-tooltip-row">
                              <span className="chart-tooltip-name">
                                <span className="chart-tooltip-dot" style={{ background: C.purple }} />
                                Faturamento Bruto
                              </span>
                              <span className="chart-tooltip-value">{fmtBRL(d.bruto)}</span>
                            </div>
                            <div className="chart-tooltip-row" style={{ marginTop: 6 }}>
                              <span style={{ fontSize: 10, color: "var(--color-muted-foreground)" }}>
                                Clique para {d.cnpj === empresaFiltro ? "remover filtro" : "filtrar"}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="bruto"
                      name="Faturamento Bruto"
                      radius={[0, 5, 5, 0]}
                      className="cursor-pointer"
                      label={{
                        position: "right",
                        formatter: (v: number) => fmtBRLCompact(v),
                        fontSize: 10,
                        fill: "oklch(0.51 0.046 257)",
                      }}
                    >
                      {rankingData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.cnpj === empresaFiltro ? C.blue : `${C.purple}cc`}
                          stroke={entry.cnpj === empresaFiltro ? C.blue : "none"}
                          strokeWidth={entry.cnpj === empresaFiltro ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ════════════════════════════════════════════════
                ROW 3 — Participação | IC×Externo | IC Participação
            ════════════════════════════════════════════════ */}
            <div data-slide-id="consolidado" className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* ── Chart 4: Participação no Consolidado (Rosca por empresa) ── */}
              <div className="chart-card flex flex-col">
                <SectionHeader
                  title="Participação no Consolidado"
                  subtitle="Por empresa prestadora"
                  accentColor={C.teal}
                  hint="Clique para drill-down"
                />
                {consolidadoData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-8">
                    Nenhum dado
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={consolidadoData}
                          dataKey="bruto"
                          nameKey="nome"
                          innerRadius={56}
                          outerRadius={82}
                          paddingAngle={2}
                          onClick={(entry) => {
                            if (entry.cnpj && entry.cnpj !== "__outros__") {
                              openDrillDown({
                                title: `Consolidado — ${entry.nome}`,
                                filter: { type: "prestador", cnpj: entry.cnpj },
                              });
                            }
                          }}
                        >
                          {consolidadoData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              strokeWidth={0}
                              className={entry.cnpj !== "__outros__" ? "cursor-pointer" : ""}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        {consolidadoData.length > 0 && (
                          <text
                            x="50%"
                            y="47%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-foreground)"
                            fontSize={13}
                            fontWeight={700}
                          >
                            {fmtBRLCompact(totalBruto)}
                          </text>
                        )}
                        {consolidadoData.length > 0 && (
                          <text
                            x="50%"
                            y="58%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="var(--color-muted-foreground)"
                            fontSize={9}
                          >
                            total
                          </text>
                        )}
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="w-full mt-1 space-y-1.5 px-1">
                      {consolidadoData.map((d) => (
                        <div
                          key={d.nome}
                          className={`flex items-center justify-between text-xs gap-2 rounded-lg px-2 py-1 transition-colors ${d.cnpj !== "__outros__" ? "hover:bg-muted/50 cursor-pointer" : ""}`}
                          onClick={() => {
                            if (d.cnpj && d.cnpj !== "__outros__") {
                              openDrillDown({
                                title: `Consolidado — ${d.nome}`,
                                filter: { type: "prestador", cnpj: d.cnpj },
                              });
                            }
                          }}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                            <span className="truncate text-muted-foreground">{d.nome}</span>
                          </span>
                          <span className="font-semibold text-foreground shrink-0">{fmtPct(d.pct)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Chart 5: Intercompany × Externo evolução (Grouped bars) ── */}
              <div className="chart-card">
                <SectionHeader
                  title="Comparativo IC × Externo"
                  subtitle="Evolução mensal — últimos 12 meses"
                  accentColor={C.blue}
                />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={icEvolucaoData}
                    margin={{ left: 0, right: 4, top: 8, bottom: 0 }}
                    onClick={(e) => {
                      if (e?.activePayload?.[0]?.payload?.name) {
                        const name = e.activePayload[0].payload.name as string;
                        // Find ym for drill-down
                        const entry = evolutionData.find(d => d.name === name);
                        if (entry) {
                          openDrillDown({
                            title: `Comparativo — ${name}`,
                            filter: { type: "competencia", value: `${entry.ym.split("-")[1]}/${entry.ym.split("-")[0]}` },
                          });
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={axGrid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "oklch(0.51 0.046 257)" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => fmtBRLCompact(Number(v))}
                      tick={{ fontSize: 9, fill: "oklch(0.51 0.046 257)" }}
                      width={62}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Bar dataKey="Externo" fill={`${C.teal}cc`} radius={[3, 3, 0, 0]} maxBarSize={18} className="cursor-pointer" />
                    <Bar dataKey="Intercompany" fill={`${C.blue}cc`} radius={[3, 3, 0, 0]} maxBarSize={18} className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
                {/* Summary row */}
                <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                  {[
                    { label: "Externo", value: externoBruto, pct: totalBruto ? (externoBruto / totalBruto) * 100 : 0, color: C.teal },
                    { label: "Intercompany", value: intercompanyBruto, pct: totalBruto ? (intercompanyBruto / totalBruto) * 100 : 0, color: C.blue },
                  ].map((row) => (
                    <div key={row.label} className="rounded-lg bg-muted/40 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">{fmtBRLCompact(row.value)}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtPct(row.pct)} do total</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Chart 6: Participação Intercompany (Rosca por empresa) ── */}
              <div className="chart-card flex flex-col">
                <SectionHeader
                  title="Participação Intercompany"
                  subtitle="Por empresa prestadora"
                  accentColor={C.red}
                  hint="Clique para drill-down"
                />
                {icParticipacaoData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-8">
                    {cnpjGrupoSet.size === 0
                      ? "Cadastre CNPJs do grupo em Configurações"
                      : "Nenhuma operação intercompany"}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={icParticipacaoData}
                          dataKey="bruto"
                          nameKey="nome"
                          innerRadius={56}
                          outerRadius={82}
                          paddingAngle={2}
                          onClick={(entry) => {
                            if (entry.cnpj && entry.cnpj !== "__outros__") {
                              openDrillDown({
                                title: `Intercompany — ${entry.nome}`,
                                filter: { type: "prestador", cnpj: entry.cnpj },
                              });
                            }
                          }}
                        >
                          {icParticipacaoData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              strokeWidth={0}
                              className={entry.cnpj !== "__outros__" ? "cursor-pointer" : ""}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="w-full mt-1 space-y-1.5 px-1">
                      {icParticipacaoData.map((d) => (
                        <div
                          key={d.nome}
                          className={`flex items-center justify-between text-xs gap-2 rounded-lg px-2 py-1 transition-colors ${d.cnpj !== "__outros__" ? "hover:bg-muted/50 cursor-pointer" : ""}`}
                          onClick={() => {
                            if (d.cnpj && d.cnpj !== "__outros__") {
                              openDrillDown({
                                title: `Intercompany — ${d.nome}`,
                                filter: { type: "prestador", cnpj: d.cnpj },
                              });
                            }
                          }}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                            <span className="truncate text-muted-foreground">{d.nome}</span>
                          </span>
                          <span className="font-semibold text-foreground shrink-0">{fmtPct(d.pct)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border w-full text-center">
                      <span className="text-[10px] text-muted-foreground">Total IC: </span>
                      <span className="text-[11px] font-semibold text-foreground">{fmtBRLCompact(intercompanyBruto)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════
                ROW 4 — Análise por Serviço
            ════════════════════════════════════════════════ */}
            <div data-slide-id="service-analysis">
            <ServiceAnalysis
              filtrados={filtrados}
              onServiceDrillDown={(serviceKey, serviceLabel) =>
                openDrillDown({
                  title: `Serviço — ${serviceLabel}`,
                  filter: { type: "servico", serviceKey, serviceLabel },
                })
              }
            />
            </div>

            {/* ── Footer note ── */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Intercompany = prestador e tomador ambos no grupo ({cnpjGrupoSet.size} CNPJ{cnpjGrupoSet.size !== 1 ? "s" : ""} cadastrado{cnpjGrupoSet.size !== 1 ? "s" : ""}).
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {ativos.length} nota{ativos.length !== 1 ? "s" : ""} ativa{ativos.length !== 1 ? "s" : ""} · {filtrados.length} total no recorte
              </span>
            </div>
          </>
        )}

        {/* ── Drill-Down Modal ── */}
        {drillDown && (
          <DrillDownModal
            title={drillDown.title}
            filter={drillDown.filter}
            filteredDocs={filtrados}
            cnpjGrupoSet={cnpjGrupoSet}
            onClose={closeDrillDown}
          />
        )}
      </div>
    </div>
  );
}
