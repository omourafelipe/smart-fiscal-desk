import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { Upload, Loader2, FileText, TrendingUp, Coins, Building2 } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { importFiles, type ImportSummary } from "@/lib/fiscal/pipeline";
import { useFiscalStore, type DrillDownFilter } from "@/store/useFiscalStore";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DrillDownModal } from "@/components/DrillDownModal";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

const MESES = [
  { v: "01", l: "Jan" }, { v: "02", l: "Fev" }, { v: "03", l: "Mar" },
  { v: "04", l: "Abr" }, { v: "05", l: "Mai" }, { v: "06", l: "Jun" },
  { v: "07", l: "Jul" }, { v: "08", l: "Ago" }, { v: "09", l: "Set" },
  { v: "10", l: "Out" }, { v: "11", l: "Nov" }, { v: "12", l: "Dez" },
];

function KpiCard({
  icon: Icon, label, value, tone = "default", onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
  onClick?: () => void;
}) {
  const toneClasses = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    accent: "text-indigo-600 dark:text-indigo-400",
  }[tone];
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 flex flex-col gap-2 ${onClick ? "kpi-clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-xl font-semibold ${toneClasses}`}>{value}</div>
    </div>
  );
}

function Dashboard() {
  const {
    mesFiltro, anoFiltro, setMesFiltro, setAnoFiltro,
    empresaFiltro, statusFiltro, operacaoFiltro,
    setEmpresaFiltro, setStatusFiltro, setOperacaoFiltro,
    drillDown, openDrillDown, closeDrillDown,
  } = useFiscalStore();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  const anos = useMemo(() => {
    const set = new Set<string>();
    (docs ?? []).forEach((d) => {
      if (d.data_competencia) set.add(d.data_competencia.slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [docs]);

  const filtrados = useMemo(() => {
    return (docs ?? []).filter((d) => {
      // Competência filter
      if (d.data_competencia) {
        const [a, m] = d.data_competencia.split("-");
        if (anoFiltro && a !== anoFiltro) return false;
        if (mesFiltro && m !== mesFiltro) return false;
      } else if (mesFiltro || anoFiltro) {
        return false;
      }
      // Empresa filter
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      // Status filter
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;
      // Operação filter
      const isIntercompany = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIntercompany) return false;
      if (operacaoFiltro === "Externas" && isIntercompany) return false;
      // "Todas" passes all
      return true;
    });
  }, [docs, mesFiltro, anoFiltro, empresaFiltro, statusFiltro, operacaoFiltro, cnpjGrupoSet]);

  // After applying status filter, "filtrados" already reflect the selected status.
  // For calculations that need only ATIVO when statusFiltro is "todos", we keep a separate list.
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

  const totalBruto = ativos.reduce((s, d) => s + d.valor_bruto, 0);
  const totalRetido = ativos.reduce((s, d) => s + d.valor_retido, 0);
  const totalLiquido = ativos.reduce((s, d) => s + d.valor_liquido, 0);
  const intercompanyBruto = intercompanyDocs.reduce((s, d) => s + d.valor_bruto, 0);
  const externoBruto = totalBruto - intercompanyBruto;

  // Aggregations for line charts (by competência)
  const chartsByCompetencia = useMemo(() => {
    const map: Record<string, { bruto: number; liquido: number; retido: number }> = {};
    filtrados.forEach((d) => {
      if (!d.data_competencia) return;
      const [a, m] = d.data_competencia.split("-");
      const key = `${m}/${a}`; // MM/YYYY
      if (!map[key]) map[key] = { bruto: 0, liquido: 0, retido: 0 };
      map[key].bruto += d.valor_bruto;
      map[key].liquido += d.valor_liquido;
      map[key].retido += d.valor_retido;
    });
    const result = Object.entries(map).map(([name, vals]) => ({ name, ...vals }));
    // Sort chronologically by year/month
    return result.sort((a, b) => {
      const [am, ay] = a.name.split("/");
      const [bm, by] = b.name.split("/");
      return ay !== by ? Number(by) - Number(ay) : Number(bm) - Number(am);
    });
  }, [filtrados]);

  // Ranking of companies (by fornecedor)
  const rankingData = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach((d) => {
      const key = d.cnpj_prestador || "";
      if (!key) return;
      map[key] = (map[key] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([cnpj, bruto]) => ({ cnpj, bruto }))
      .sort((a, b) => b.bruto - a.bruto);
  }, [filtrados]);

  // Participation donut data
  const participationData = useMemo(() => {
    const total = totalBruto;
    return [
      { name: "Intercompany", value: intercompanyBruto },
      { name: "Externo", value: externoBruto },
    ].map((item) => ({ ...item, percent: total ? (item.value / total) * 100 : 0 }));
  }, [intercompanyBruto, externoBruto, totalBruto]);


  const barData = [
    { name: "Externo", value: externoBruto },
    { name: "Intercompany", value: intercompanyBruto },
  ];

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

  // SSR-safe: never render different content server vs client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores recalculados automaticamente a partir das notas ativas.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={mesFiltro || "__all__"} onValueChange={(v) => setMesFiltro(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos meses</SelectItem>
              {MESES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anoFiltro || "__all__"} onValueChange={(v) => setAnoFiltro(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos anos</SelectItem>
              {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Empresa Filter */}
          <Select value={empresaFiltro || "__grupo__"} onValueChange={(v) => setEmpresaFiltro(v === "__grupo__" ? "" : v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__grupo__">Consolidado do Grupo</SelectItem>
              {grupoCnpjs?.map((g) => (
                <SelectItem key={g.cnpj} value={g.cnpj}>{fmtCnpj(g.cnpj)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Status Filter */}
          <div className="flex gap-1 text-xs">
            {(["todos", "Ativo", "Cancelado"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFiltro(s)}
                className={`px-3 py-1.5 rounded-md font-medium border transition-colors ${
                  statusFiltro === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "todos" ? "Todos" : s}
              </button>
            ))}
          </div>
          {/* Operação Filter */}
          <div className="flex gap-1 text-xs">
            {(["Todas", "Externas", "Intercompany"] as const).map((op) => (
              <button
                key={op}
                onClick={() => setOperacaoFiltro(op)}
                className={`px-3 py-1.5 rounded-md font-medium border transition-colors ${
                  operacaoFiltro === op
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card/30"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">Importar NFS-e Nacional</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Arraste arquivos .xml ou .zip aqui, ou clique para selecionar.
            </div>
          </div>
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
          <Button onClick={() => inputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
            {importing ? "Importando..." : "Selecionar arquivos"}
          </Button>
        </div>
        {importing && progress && progress.total > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            Processando {progress.done} / {progress.total} XMLs...
            <div className="h-1.5 mt-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        {lastSummary && !importing && (
          <div className="mt-3 text-xs text-muted-foreground">
            Último lote: <strong>{lastSummary.importadas}</strong> importadas,{" "}
            <strong>{lastSummary.duplicadas}</strong> duplicadas,{" "}
            <strong>{lastSummary.erros}</strong> erro(s) de leitura.
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Faturamento Bruto" value={fmtBRL(totalBruto)} tone="default"
          onClick={() => openDrillDown({ title: "Faturamento Bruto", filter: { type: "all" } })} />
        <KpiCard icon={Coins} label="Retenções" value={fmtBRL(totalRetido)} tone="negative"
          onClick={() => openDrillDown({ title: "Retenções", filter: { type: "all" } })} />
        <KpiCard icon={TrendingUp} label="Faturamento Líquido" value={fmtBRL(totalLiquido)} tone="positive"
          onClick={() => openDrillDown({ title: "Faturamento Líquido", filter: { type: "all" } })} />
        <KpiCard icon={Building2} label="Intercompany" value={fmtBRL(intercompanyBruto)} tone="accent"
          onClick={() => openDrillDown({ title: "Intercompany", filter: { type: "intercompany" } })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução do Faturamento */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Evolução do Faturamento (Bruto & Líquido)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartsByCompetencia} onClick={(e) => {
              if (e?.activeLabel) openDrillDown({ title: `Faturamento — ${e.activeLabel}`, filter: { type: "competencia", value: e.activeLabel } });
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmtBRL(Number(v))} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="bruto" name="Bruto" stroke="hsl(var(--primary))" activeDot={{ r: 6, className: "cursor-pointer" }} />
              <Line type="monotone" dataKey="liquido" name="Líquido" stroke="hsl(var(--emerald-600))" activeDot={{ r: 6, className: "cursor-pointer" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Evolução das Retenções */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Evolução das Retenções</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartsByCompetencia} onClick={(e) => {
              if (e?.activeLabel) openDrillDown({ title: `Retenções — ${e.activeLabel}`, filter: { type: "competencia", value: e.activeLabel } });
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmtBRL(Number(v))} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="retido" name="Retenções" stroke="hsl(var(--rose))" activeDot={{ r: 6, className: "cursor-pointer" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking de Empresas */}
      <div className="rounded-xl border border-border bg-card p-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Ranking de Empresas (Faturamento Bruto)</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, rankingData.length * 40 + 60)}>
          <BarChart data={rankingData} layout="vertical" margin={{ left: 80 }} onClick={(e) => {
            if (e?.activePayload?.[0]?.payload?.cnpj) {
              const cnpj = e.activePayload[0].payload.cnpj;
              openDrillDown({ title: `Prestador — ${fmtCnpj(cnpj)}`, filter: { type: "prestador", cnpj } });
            }
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tickFormatter={(v) => fmtBRL(Number(v))} tick={{ fontSize: 11 }} />
            <YAxis dataKey="cnpj" type="category" tickFormatter={(c) => fmtCnpj(c)} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
            <Bar dataKey="bruto" fill="hsl(var(--primary))" className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Participação no Consolidado */}
      <div className="rounded-xl border border-border bg-card p-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Participação no Consolidado</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={participationData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              onClick={(_: unknown, idx: number) => {
                const filterType = idx === 0 ? "intercompany" : "externo";
                const label = idx === 0 ? "Intercompany" : "Externo";
                openDrillDown({ title: `Participação — ${label}`, filter: { type: filterType } as DrillDownFilter });
              }}
            >
              {participationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Comparativo Intercompany x Externo */}
      <div className="rounded-xl border border-border bg-card p-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Comparativo Intercompany x Externo</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData} onClick={(e) => {
            if (e?.activePayload?.[0]?.payload?.name) {
              const name = e.activePayload[0].payload.name as string;
              const filterType = name === "Intercompany" ? "intercompany" : "externo";
              openDrillDown({ title: `Comparativo — ${name}`, filter: { type: filterType } as DrillDownFilter });
            }
          }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => fmtBRL(Number(v))} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
            <Legend />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Participação Intercompany */}
      <div className="rounded-xl border border-border bg-card p-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Participação Intercompany</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={participationData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              onClick={(_: unknown, idx: number) => {
                const filterType = idx === 0 ? "intercompany" : "externo";
                const label = idx === 0 ? "Intercompany" : "Externo";
                openDrillDown({ title: `Intercompany — ${label}`, filter: { type: filterType } as DrillDownFilter });
              }}
            >
              {participationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary))"} className="cursor-pointer" />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[11px] text-muted-foreground mt-2">
          Intercompany = notas onde prestador e tomador estão no Grupo (
          {cnpjGrupoSet.size} CNPJ{cnpjGrupoSet.size === 1 ? "" : "s"} cadastrado{cnpjGrupoSet.size === 1 ? "" : "s"}).
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        {ativos.length} nota(s) ativa(s) no recorte atual · {filtrados.length} total no período.
      </div>

      {/* Drill-Down Modal */}
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
  );
}
