import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import JSZip from "jszip";
import { z } from "zod";
import {
  BarChart,
  Bar,
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
} from "recharts";
import {
  Upload,
  FileText,
  Download,
  Building2,
  TrendingUp,
  Receipt,
  Loader2,
  Calendar,
  Tag,
  Search,
} from "lucide-react";

import { db, type NotaFiscal } from "@/lib/db";
import { parseNfseXml } from "@/lib/parseXml";
import { getServicoDescricao } from "@/lib/category-utils";
import { autoCadastrarCategoriasParaNovosCodigos } from "@/lib/category-suggester";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useFiscalData } from "@/hooks/useFiscalData";
import { KpiCardNew } from "@/components/shared/KpiCardNew";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: Dashboard,
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

const formatarCompetencia = (competenciaStr: string) => {
  if (!competenciaStr) return "—";
  try {
    const clean = competenciaStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return competenciaStr;
  } catch {
    return competenciaStr;
  }
};

const mesesOpcoes = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });
  const { periodType, addActivity } = useLayoutShell();

  // Filters synced via URL search parameters
  const mesFiltro = search.mes || "__all__";
  const anoFiltro = search.ano || "__all__";
  const empresaFiltro = search.empresa || "__all__";
  const cServFiltro = search.cServ || "__all__";
  const searchCliente = search.searchCliente || "";

  // Local query states
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync route filters change to page 1 reset
  useEffect(() => {
    setCurrentPage(1);
  }, [mesFiltro, anoFiltro, empresaFiltro, cServFiltro, searchCliente]);

  const setMesFiltro = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, mes: val === "__all__" ? undefined : val }) });
  const setAnoFiltro = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, ano: val === "__all__" ? undefined : val }) });
  const setEmpresaFiltro = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, empresa: val === "__all__" ? undefined : val }) });
  const setCServFiltro = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, cServ: val === "__all__" ? undefined : val }) });
  const setSearchCliente = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, searchCliente: val || undefined }) });

  // Load analytical and aggregate data using useFiscalData hook
  const {
    empresas,
    anos,
    notasFiltradas,
    notasAtivas,
    faturamento,
    faturamentoTrend,
    plansFaturamento,
    plansTrend,
    hospFaturamento,
    hospTrend,
    notasAtivasTrend,
    cancelRate,
    cancelRateTrend,
    valorCancelado,
    issRetidoTotal,
    issARecolherTotal,
    tributosFederaisTotal,
    pisTotal,
    cofinsTotal,
    csllTotal,
    irrfTotal,
    inssTotal,
    lineChartData,
    barData,
    topClientesList,
    getNoteStatus,
    getDateField,
  } = useFiscalData({
    filters: {
      empresaFiltro,
      mesFiltro,
      anoFiltro,
      cServFiltro,
      searchCliente,
    },
    periodType,
    xlsxRows: [],
    keyCol: "",
    statusCol: "",
  });

  // Calculate local chart breakdown data (PJ vs PF type of contracting)
  const pjPfData = useMemo(() => {
    let empresarialTotal = 0;
    let adesaoTotal = 0;
    let individualTotal = 0;
    let empresarialCount = 0;
    let adesaoCount = 0;
    let individualCount = 0;

    notasAtivas.forEach((n) => {
      const code = String(n.codTribNacional || "").replace(/^0+/, "");
      if (code === "40301" || code === "040301") return;

      const cleanKey = String(n.cnpjCpfCliente ?? "").replace(/\D/g, "");
      const isPlural = (n.cliente || "").toUpperCase().includes("PLURAL GESTAO");

      if (isPlural) {
        adesaoTotal += n.valor;
        adesaoCount++;
      } else if (cleanKey.length === 11) {
        individualTotal += n.valor;
        individualCount++;
      } else {
        empresarialTotal += n.valor;
        empresarialCount++;
      }
    });

    const data = [];
    if (empresarialTotal > 0 || empresarialCount > 0) {
      data.push({ name: "Empresarial", value: empresarialTotal, count: empresarialCount });
    }
    if (adesaoTotal > 0 || adesaoCount > 0) {
      data.push({ name: "Adesão", value: adesaoTotal, count: adesaoCount });
    }
    if (individualTotal > 0 || individualCount > 0) {
      data.push({ name: "Individual/Familiar", value: individualTotal, count: individualCount });
    }
    return data;
  }, [notasAtivas]);

  // Planos vs Hospitais comparativo data
  const comparativoServicosData = useMemo(() => {
    let planosTotal = 0;
    let hospitaisTotal = 0;
    notasAtivas.forEach((n) => {
      const code = String(n.codTribNacional || "").replace(/^0+/, "");
      if (code === "42201") {
        planosTotal += n.valor;
      } else if (code === "40301" || code === "43301") {
        hospitaisTotal += n.valor;
      }
    });
    return [
      { name: "Planos de Saúde", value: planosTotal, fill: "#6366f1" },
      { name: "Serviços Hospitalares", value: hospitaisTotal, fill: "#14b8a6" },
    ];
  }, [notasAtivas]);

  // Sort and paginate notes
  const sortedNotas = useMemo(() => {
    return [...notasFiltradas].sort((a, b) => (getDateField(b) || "").localeCompare(getDateField(a) || ""));
  }, [notasFiltradas, getDateField]);

  const paginatedNotas = useMemo(() => {
    return sortedNotas.slice((currentPage - 1) * 100, currentPage * 100);
  }, [sortedNotas, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(sortedNotas.length / 100);
  }, [sortedNotas]);

  // File import processor
  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setImporting(true);
      const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".zip"));
      if (!arr.length) {
        toast.error("Envie arquivos .zip contendo XMLs NFS-e.");
        setImporting(false);
        return;
      }

      const allNotas: NotaFiscal[] = [];
      let skipped = 0;
      let totalXmls = 0;
      const zipEntries: { zip: JSZip; entries: JSZip.JSZipObject[] }[] = [];

      for (const file of arr) {
        try {
          const zip = await JSZip.loadAsync(file);
          const xmlEntries = Object.values(zip.files).filter(
            (f) => !f.dir && f.name.toLowerCase().endsWith(".xml"),
          );
          totalXmls += xmlEntries.length;
          zipEntries.push({ zip, entries: xmlEntries });
        } catch (e) {
          console.error(e);
          toast.error(`Erro ao abrir o arquivo ZIP ${file.name}`);
        }
      }

      let doneXmls = 0;
      setProgress({ done: 0, total: totalXmls });

      for (const { zip, entries } of zipEntries) {
        for (const entry of entries) {
          try {
            const xml = await entry.async("string");
            const nota = parseNfseXml(xml);
            if (nota) allNotas.push(nota);
            else skipped++;
          } catch (e) {
            console.error(e);
            skipped++;
          }
          doneXmls++;
          if (doneXmls % 25 === 0 || doneXmls === totalXmls) {
            setProgress({ done: doneXmls, total: totalXmls });
          }
        }
      }

      if (allNotas.length) {
        await db.notas.bulkPut(allNotas);
        const uniqueImportedCodes = Array.from(new Set(allNotas.map(n => n.codTribNacional).filter(Boolean)));
        await autoCadastrarCategoriasParaNovosCodigos(uniqueImportedCodes);
        addActivity("upload", `${allNotas.length} Notas Importadas`, "Importação de XMLs finalizada com sucesso.");
      }
      setProgress(null);
      setImporting(false);
      toast.success(
        `${allNotas.length} nota(s) importada(s). ${skipped ? skipped + " ignorada(s)." : ""}`,
      );
    },
    [addActivity],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const exportCsv = () => {
    const headers = [
      "Número NFS",
      "Data Emissão",
      "Competência",
      "CNPJ/CPF Cliente",
      "Cliente",
      "Vlr. Serviço",
      "Vlr. Líquido",
      "Vlr. ISS",
      "ISS Retido?",
      "Vlr. PIS",
      "Vlr. COFINS",
      "Vlr. CSLL",
      "Vlr. IRRF",
      "Vlr. INSS",
      "Serviço",
      "Situação",
    ];
    const rows = notasFiltradas.map((n) => [
      n.nNFSe,
      formatarData(n.dhEmi),
      formatarCompetencia(n.dCompet),
      formatarCnpjCpf(n.cnpjCpfCliente),
      n.cliente,
      n.valor.toFixed(2),
      (n.vlrLiquido ?? n.valor).toFixed(2),
      (n.vlrIss ?? 0).toFixed(2),
      n.issRetido || "Não",
      (n.vlrPis ?? 0).toFixed(2),
      (n.vlrCofins ?? 0).toFixed(2),
      (n.vlrCsll ?? 0).toFixed(2),
      (n.vlrIrrf ?? 0).toFixed(2),
      (n.vlrInss ?? 0).toFixed(2),
      n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—",
      getNoteStatus(n) === "válida" ? "Válida" : "Cancelada",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* PAGE MAIN HEADER / FILTERS PANEL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Consulta de Faturamento</h1>
          <p className="text-xs text-muted-foreground mt-1">Análise consolidada para a diretoria · Samel</p>
        </div>

        {/* Filters Grid */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
            <SelectTrigger className="w-[220px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
              <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todas as Empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.cnpj} value={e.cnpj}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {mesesOpcoes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={anoFiltro} onValueChange={setAnoFiltro}>
            <SelectTrigger className="w-[105px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os anos</SelectItem>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cServFiltro} onValueChange={setCServFiltro}>
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors">
              <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os Serviços</SelectItem>
              <SelectItem value="042201">Planos de Saúde</SelectItem>
              <SelectItem value="040301">Serviços Hospitalares</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* UPLOAD ZIP PANEL */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !importing && document.getElementById("file-input-fat")?.click()}
        className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-300 ${
          dragOver
            ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 scale-[1.005] shadow-sm"
            : "border-border bg-card text-card-foreground hover:border-indigo-500/50 hover:bg-slate-50/30 dark:hover:bg-slate-800/10"
        }`}
      >
        <input
          id="file-input-fat"
          type="file"
          accept=".zip"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          {importing ? (
            <>
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="font-semibold text-xs text-foreground">Processando XMLs NFS-e...</p>
              {progress && (
                <p className="text-[10px] text-muted-foreground">
                  {progress.done} / {progress.total} XMLs
                </p>
              )}
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="font-semibold text-xs text-foreground">
                Arraste os arquivos .zip de XMLs aqui ou clique para selecionar
              </p>
              <p className="text-[10px] text-muted-foreground">
                Suporta múltiplos arquivos ZIP contendo XMLs no padrão NFS-e Nacional (SPED v1.01)
              </p>
            </>
          )}
        </div>
      </div>

      {/* METRICS / KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        <KpiCardNew
          label="Faturamento"
          value={fmtBRL(faturamento)}
          trendText={faturamentoTrend.text}
          isPositive={faturamentoTrend.isPositive}
          subtext="comparado ao período anterior"
          tone="blue"
        />
        <KpiCardNew
          label="Plano de Saúde"
          value={fmtBRL(plansFaturamento)}
          trendText={plansTrend.text}
          isPositive={plansTrend.isPositive}
          subtext="código 042201"
          tone="purple"
        />
        <KpiCardNew
          label="Serviços Hospitalares"
          value={fmtBRL(hospFaturamento)}
          trendText={hospTrend.text}
          isPositive={hospTrend.isPositive}
          subtext="códigos 040301, 043301"
          tone="green"
        />
        <KpiCardNew
          label="Notas Emitidas"
          value={notasAtivas.length.toLocaleString("pt-BR")}
          trendText={notasAtivasTrend.text}
          isPositive={notasAtivasTrend.isPositive}
          subtext="notas fiscais com status ativo"
          tone="amber"
        />
        <KpiCardNew
          label="Cancelamento / Substituição"
          value={`${cancelRate.toFixed(1)}%`}
          trendText={cancelRateTrend.text}
          isPositive={!cancelRateTrend.isPositive}
          subtext={`${fmtBRL(valorCancelado)} estornados`}
          tone="rose"
        />
      </div>

      {/* TAXES SUMMARY PANEL */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Detalhamento de Impostos & Tributos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ISS Retido */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">ISS Retido</p>
              <p className="text-lg font-bold text-foreground mt-1.5">{fmtBRL(issRetidoTotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Retido na fonte pelo tomador</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* ISS a Recolher */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">ISS a Recolher</p>
              <p className="text-lg font-bold text-foreground mt-1.5">{fmtBRL(issARecolherTotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Recolhimento próprio do prestador</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Receipt className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* Demais Tributos Federais */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tributos Federais</p>
              <p className="text-lg font-bold text-foreground mt-1.5">{fmtBRL(tributosFederaisTotal)}</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 pt-1 border-t border-border/50 text-[9px] text-muted-foreground font-mono">
                <div>PIS: <span className="text-foreground/85 font-semibold">{fmtBRL(pisTotal)}</span></div>
                <div>COFINS: <span className="text-foreground/85 font-semibold">{fmtBRL(cofinsTotal)}</span></div>
                <div>CSLL: <span className="text-foreground/85 font-semibold">{fmtBRL(csllTotal)}</span></div>
                <div>IRRF: <span className="text-foreground/85 font-semibold">{fmtBRL(irrfTotal)}</span></div>
                <div className="col-span-2">INSS: <span className="text-foreground/85 font-semibold">{fmtBRL(inssTotal)}</span></div>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY CHARTS & DETAILS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Faturamento Line Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-12 transition-colors duration-300">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h3 className="text-xs font-bold text-foreground">Evolução do Faturamento</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Comparativo do faturamento com o período imediatamente anterior</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                <span>Período Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                <span className="border-b border-dashed border-muted-foreground/60 pb-0.5">Período Anterior</span>
              </div>
            </div>
          </div>

          <div className="h-[280px]">
            {lineChartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={lineChartData}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      const mesesSiglas: Record<string, string> = {
                        Jan: "01",
                        Fev: "02",
                        Mar: "03",
                        Abr: "04",
                        Mai: "05",
                        Jun: "06",
                        Jul: "07",
                        Ago: "08",
                        Set: "09",
                        Out: "10",
                        Nov: "11",
                        Dez: "12",
                      };
                      const selectedMonth = mesesSiglas[state.activeLabel];
                      if (selectedMonth) {
                        setMesFiltro(selectedMonth);
                        addActivity(
                          "update",
                          `Mês Selecionado: ${state.activeLabel}`,
                          `Dashboard filtrado para o mês de ${state.activeLabel} via clique no gráfico.`,
                        );
                        toast.success(`Filtrado pelo mês: ${state.activeLabel}`);
                      }
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v) => fmtBRL(Number(v))}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-foreground)",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Período Anterior"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#colorPrev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Período Atual"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCurrent)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* SECONDARY CHARTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Donut Chart: Faturamento PJ vs PF */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300">
          <h3 className="text-xs font-bold text-foreground mb-1">Tipo de Contratação</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Faturamento distribuído por tipo de contratação</p>

          <div className="h-[200px] flex items-center justify-center relative">
            {pjPfData.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pjPfData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="var(--color-card)"
                      strokeWidth={3}
                    >
                      {pjPfData.map((entry, index) => {
                        const colors = ["#6366f1", "#14b8a6", "#ec4899"];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtBRL(Number(v))}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
                  <span className="text-xs font-extrabold text-foreground">
                    {faturamento >= 1000000 ? `R$ ${(faturamento / 1000000).toFixed(1)}M` : `R$ ${(faturamento / 1000).toFixed(0)}k`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-border/50 text-xs">
            {pjPfData.map((item, idx) => {
              const colors = ["#6366f1", "#14b8a6", "#ec4899"];
              return (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                    <span className="font-semibold text-foreground/90 truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="font-bold text-foreground">
                      {item.value >= 1000000
                        ? `${(item.value / 1000000).toFixed(1).replace(".", ",")} mi`
                        : item.value >= 1000
                          ? `${(item.value / 1000).toFixed(1).replace(".", ",")} k`
                          : fmtBRL(item.value)}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">{item.count} notas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut Chart: Planos vs Hospitais Comparativo */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300">
          <h3 className="text-xs font-bold text-foreground mb-1">Comparativo por Tipo de Serviço</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Planos de Saúde vs. Serviços Hospitalares</p>

          <div className="h-[200px] flex items-center justify-center relative">
            {comparativoServicosData.every((d) => d.value === 0) ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={comparativoServicosData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="var(--color-card)"
                      strokeWidth={3}
                    >
                      {comparativoServicosData
                        .filter((d) => d.value > 0)
                        .map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtBRL(Number(v))}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Foco BI</span>
                  <span className="text-xs font-bold text-foreground">Samel</span>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-around items-center mt-3 pt-3 border-t border-border/50 text-xs">
            {comparativoServicosData.filter((d) => d.value > 0).map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="truncate max-w-[100px]">{item.name}</span>
                </div>
                <span className="font-bold text-foreground mt-0.5">{fmtBRL(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clients Table */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-1 transition-colors duration-300">
          <h3 className="text-xs font-bold text-foreground mb-1">Principais Clientes</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Top 5 tomadores por volume de faturamento</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-2 font-medium">Nome / CNPJ</th>
                  <th className="pb-2 text-center font-medium">Notas</th>
                  <th className="pb-2 text-right font-medium">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {topClientesList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted-foreground py-12">Nenhum cliente registrado</td>
                  </tr>
                ) : (
                  topClientesList.map((client, index) => {
                    return (
                      <tr key={index} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 max-w-[120px]">
                          <div className="font-semibold text-foreground/90 truncate" title={client.nome}>
                            {client.nome}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                            {formatarCnpjCpf(client.cnpjCpf)}
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-muted-foreground font-mono text-[10px]">{client.count}</td>
                        <td className="py-2.5 text-right font-bold text-foreground">{fmtBRL(client.total)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NFS-e PRIMARY TABLE LIST */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Notas Fiscais Emitidas ({notasFiltradas.length.toLocaleString("pt-BR")})
          </h3>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou nº NFS..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="pl-8 h-8 rounded-lg text-xs bg-muted border-border hover:bg-muted/80 focus:bg-card placeholder:text-muted-foreground w-full"
              />
            </div>
            <button
              onClick={exportCsv}
              disabled={!notasFiltradas.length}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer border border-indigo-500/25 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1400px]">
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead className="font-medium text-muted-foreground h-9">Situação</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Nº NFS</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Emissão</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Competência</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">CNPJ/CPF</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Cliente</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Serviço</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Líquido</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. ISS</TableHead>
                <TableHead className="text-center font-medium text-muted-foreground h-9">ISS Retido?</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">IRRF</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">CSLL</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">PIS</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">COFINS</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">INSS</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Serviço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedNotas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center text-muted-foreground py-12 text-xs">
                    Nenhuma nota fiscal encontrada no banco local. Envie um ZIP com XMLs para começar.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedNotas.map((n) => (
                  <TableRow key={n.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <TableCell>
                      {getNoteStatus(n) === "válida" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                          Válida
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                          Cancelada
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-foreground/95 font-semibold">{n.nNFSe}</TableCell>
                    <TableCell className="text-xs text-foreground/90 whitespace-nowrap">{formatarData(n.dhEmi)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatarCompetencia(n.dCompet)}</TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{formatarCnpjCpf(n.cnpjCpfCliente)}</TableCell>
                    <TableCell className="text-xs text-foreground/90 max-w-[180px] truncate font-medium" title={n.cliente}>{n.cliente}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">{fmtBRL(n.valor)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground/80">{fmtBRL(n.vlrLiquido ?? n.valor)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmtBRL(n.vlrIss ?? 0)}</TableCell>
                    <TableCell className="text-center">
                      {n.issRetido === "Sim" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          Não
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmtBRL(n.vlrIrrf ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmtBRL(n.vlrCsll ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmtBRL(n.vlrPis ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmtBRL(n.vlrCofins ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">{fmtBRL(n.vlrInss ?? 0)}</TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground max-w-[200px] truncate"
                      title={n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}
                    >
                      {n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap text-xs text-muted-foreground">
            <div>
              Exibindo {Math.min(sortedNotas.length, (currentPage - 1) * 100 + 1)} a{" "}
              {Math.min(sortedNotas.length, currentPage * 100)} de {sortedNotas.length} notas
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="h-8 text-xs rounded-lg border-slate-200"
              >
                Anterior
              </Button>
              <span className="px-3 font-semibold text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-8 text-xs rounded-lg border-slate-200"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] text-muted-foreground pt-8 border-t border-border/80">
        🔒 Processamento 100% Client-Side local — Seus XMLs NFS-e e planilhas financeiras nunca saem do seu navegador.
      </footer>
    </main>
  );
}
