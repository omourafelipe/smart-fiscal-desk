import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Upload, Loader2, FileText, TrendingUp, Coins, Building2 } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import { importFiles, type ImportSummary } from "@/lib/fiscal/pipeline";
import { useFiscalStore } from "@/store/useFiscalStore";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  { v: "01", l: "Jan" }, { v: "02", l: "Fev" }, { v: "03", l: "Mar" },
  { v: "04", l: "Abr" }, { v: "05", l: "Mai" }, { v: "06", l: "Jun" },
  { v: "07", l: "Jul" }, { v: "08", l: "Ago" }, { v: "09", l: "Set" },
  { v: "10", l: "Out" }, { v: "11", l: "Nov" }, { v: "12", l: "Dez" },
];

function KpiCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  const toneClasses = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    accent: "text-indigo-600 dark:text-indigo-400",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
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
  const { mesFiltro, anoFiltro, setMesFiltro, setAnoFiltro } = useFiscalStore();
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
      if (!d.data_competencia) return mesFiltro === "" && anoFiltro === "";
      const [a, m] = d.data_competencia.split("-");
      if (anoFiltro && a !== anoFiltro) return false;
      if (mesFiltro && m !== mesFiltro) return false;
      return true;
    });
  }, [docs, mesFiltro, anoFiltro]);

  const ativos = useMemo(
    () => filtrados.filter((d) => d.status_manual === "Ativo"),
    [filtrados]
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
        <KpiCard icon={TrendingUp} label="Faturamento Bruto" value={fmtBRL(totalBruto)} tone="default" />
        <KpiCard icon={Coins} label="Retenções" value={fmtBRL(totalRetido)} tone="negative" />
        <KpiCard icon={TrendingUp} label="Faturamento Líquido" value={fmtBRL(totalLiquido)} tone="positive" />
        <KpiCard icon={Building2} label="Intercompany" value={fmtBRL(intercompanyBruto)} tone="accent" />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Faturamento Externo vs Intercompany</h2>
        {mounted && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(Number(v))} width={110} />
                <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
                <Legend />
                <Bar dataKey="value" name="Faturamento Bruto" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="text-[11px] text-muted-foreground mt-2">
          Intercompany = notas onde prestador e tomador estão no Grupo (
          {cnpjGrupoSet.size} CNPJ{cnpjGrupoSet.size === 1 ? "" : "s"} cadastrado{cnpjGrupoSet.size === 1 ? "" : "s"}).
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        {ativos.length} nota(s) ativa(s) no recorte atual · {filtrados.length} total no período.
      </div>
    </div>
  );
}
