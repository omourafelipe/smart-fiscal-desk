import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useGlobalFilters } from "@/store/useGlobalFilters";
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
  LineChart,
  Line,
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
  FileSpreadsheet,
  Printer,
  AlertTriangle,
} from "lucide-react";

import { db, type NotaFiscal } from "@/lib/db";
import { parseNfseXml } from "@/lib/parseXml";
import { CategoryLabelService } from "@/lib/services/CategoryLabelService";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useFiscalData } from "@/hooks/useFiscalData";
import { useInsightsEngine } from "@/hooks/useInsightsEngine";
import { useAnomalias } from "@/hooks/useAnomalias";
import { ExecutiveInsights } from "@/components/dashboard/ExecutiveInsights";
import { BarChartRanking } from "@/components/dashboard/charts/BarChartRanking";
import { KpiCardNew } from "@/components/shared/KpiCardNew";
import { UpcomingObligationsWidget } from "@/components/dashboard/UpcomingObligationsWidget";
import { calcularProximasObrigacoes } from "@/lib/obrigacoes";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { SyncManager } from "@/lib/data-access/SyncManager";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-2.5 rounded-xl shadow-md text-[10px] font-medium text-foreground">
        <p className="font-bold">{payload[0].name}</p>
        <p className="text-indigo-600 dark:text-indigo-400 mt-0.5">{fmtBRL(Number(payload[0].value))}</p>
      </div>
    );
  }
  return null;
};

const NfseCountTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border p-2.5 rounded-xl shadow-md text-[10px] font-medium text-foreground">
        <p className="font-bold">{payload[0].name || payload[0].payload.label}</p>
        {payload.map((item: any, idx: number) => (
          <p key={idx} className={`${idx === 0 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} mt-0.5`}>
            {item.name}: {item.value} nota(s)
          </p>
        ))}
      </div>
    );
  }
  return null;
};

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

function groupIntoOutros(data: any[], percentThreshold = 3) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  if (total === 0) return data;
  let groupedValue = 0;
  let groupedCount = 0;
  const filtered = data.filter((item) => {
    const pct = (item.value / total) * 100;
    if (pct < percentThreshold) {
      groupedValue += item.value;
      groupedCount += (item.count || 0);
      return false;
    }
    return true;
  });
  if (groupedValue > 0) {
    filtered.push({ name: "Outros", value: groupedValue, count: groupedCount, fill: "#94a3b8" });
  }
  return filtered;
}

function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });
  const { periodType, addActivity } = useLayoutShell();

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tipoClienteFiltro, setTipoClienteFiltro] = useState<string>("__all__");
  const { searchCliente, setSearchCliente, cServFiltro, setCServFiltro } = useGlobalFilters();
  const { session } = useAuthStore();

  const [activePieIndex1, setActivePieIndex1] = useState<number | null>(null);
  const [activePieIndex2, setActivePieIndex2] = useState<number | null>(null);

  const [selectedNotaForPrint, setSelectedNotaForPrint] = useState<NotaFiscal | null>(null);

  const [obligationsTrigger, setObligationsTrigger] = useState(0);

  const handlePrintNota = (n: NotaFiscal) => {
    setSelectedNotaForPrint(n);
    setTimeout(() => {
      document.body.classList.add("print-receipt-mode");
      window.print();
      document.body.classList.remove("print-receipt-mode");
      setSelectedNotaForPrint(null);
    }, 150);
  };

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
    nfseCountChartData,
    barData,
    pieData,
    topClientesList,
    getNoteStatus,
    getDateField,
    prevFaturamento,
    prevNotasCount,
    ticketMedio,
    todasNotasTomadas,
  } = useFiscalData({
    periodType,
    xlsxRows: [],
    keyCol: "",
    statusCol: "",
  });

  const uniqueMuniCodes = useMemo(() => {
    const set = new Set<string>();
    notasAtivas.forEach((n) => {
      if (n.issRetido === "Não" && (n.vlrIss ?? 0) > 0 && n.codTribNacional) {
        set.add(n.codTribNacional);
      }
    });
    (todasNotasTomadas || []).forEach((n) => {
      if (n.status === "válida" && n.issRetido === "Sim" && (n.vlrIssRet ?? 0) > 0 && n.codTribNacional) {
        set.add(n.codTribNacional);
      }
    });
    return Array.from(set);
  }, [notasAtivas, todasNotasTomadas]);

  const obligations = useMemo(() => {
    const activeTomadas = (todasNotasTomadas || []).filter((n) => n.status === "válida");
    return calcularProximasObrigacoes(notasAtivas, activeTomadas, new Date());
  }, [notasAtivas, todasNotasTomadas, obligationsTrigger]);

  const insights = useInsightsEngine({
    faturamento,
    prevFaturamento,
    ticketMedio,
    notasAtivasCount: notasAtivas.length,
    prevNotasCount,
    pieData,
    lineChartData,
  });

  const { activeCompanyAnomaly } = useAnomalias();

  const combinedInsights = useMemo(() => {
    const list = [...insights];
    if (activeCompanyAnomaly) {
      list.unshift({
        id: "anomaly-alert",
        type: "warning",
        title: "Alerta de Anomalia de Faturamento",
        description: activeCompanyAnomaly.description,
        icon: AlertTriangle,
      });
    }
    return list;
  }, [insights, activeCompanyAnomaly]);

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
      const clean = String(n.codTribNacional || "").replace(/\D/g, "");
      if (clean.startsWith("422") || clean.startsWith("0422")) {
        planosTotal += n.valor;
      } else if (
        clean.startsWith("423") || clean.startsWith("0423") ||
        clean.startsWith("403") || clean.startsWith("0403") ||
        clean.startsWith("433") || clean.startsWith("0433")
      ) {
        hospitaisTotal += n.valor;
      }
    });
    return [
      { name: "Plano de Saúde", value: planosTotal, fill: "#6366f1" },
      { name: "Serviços Hospitalares", value: hospitaisTotal, fill: "#14b8a6" },
    ];
  }, [notasAtivas]);

  // Helper to determine PJ/PF category
  const obterTipoCliente = useCallback((n: NotaFiscal) => {
    const code = String(n.codTribNacional || "").replace(/^0+/, "");
    if (code === "40301" || code === "040301") return "Outros";
    const cleanKey = String(n.cnpjCpfCliente ?? "").replace(/\D/g, "");
    const isPlural = (n.cliente || "").toUpperCase().includes("PLURAL GESTAO");
    if (isPlural) return "Adesão";
    if (cleanKey.length === 11) return "Individual/Familiar";
    return "Empresarial";
  }, []);

  // Sort and paginate notes
  const sortedNotas = useMemo(() => {
    let list = [...notasFiltradas];
    if (tipoClienteFiltro !== "__all__") {
      list = list.filter((n) => obterTipoCliente(n) === tipoClienteFiltro);
    }
    return list.sort((a, b) => (getDateField(b) || "").localeCompare(getDateField(a) || ""));
  }, [notasFiltradas, tipoClienteFiltro, obterTipoCliente, getDateField]);

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
        addActivity("upload", `${allNotas.length} Notas Importadas`, "Importação de XMLs finalizada com sucesso.");
        if (session?.user?.id) {
          SyncManager.syncAll(session.user.id);
        }
      }
      setProgress(null);
      setImporting(false);
      toast.success(
        `${allNotas.length} nota(s) importada(s). ${skipped ? skipped + " ignorada(s)." : ""}`,
      );
    },
    [addActivity],
  );



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
      n.codTribNacional ? `${n.codTribNacional} - ${CategoryLabelService.getFriendlyName(n.codTribNacional)}` : "—",
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

  const handleExportExcel = async () => {
    const { empresaFiltro, mesFiltro, anoFiltro } = useGlobalFilters.getState();
    const filteredTomadas = (todasNotasTomadas || []).filter((n) => {
      const dateStr = (periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "");
      const ds = dateStr.slice(0, 10);
      if (mesFiltro !== "__all__" && ds.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && ds.slice(0, 4) !== anoFiltro) return false;
      if (empresaFiltro !== "__all__" && n.cnpjTomador !== empresaFiltro) return false;
      if (searchCliente) {
        const query = searchCliente.toLowerCase().trim();
        const matchFornecedor = (n.nomePrestador || "").toLowerCase().includes(query);
        const matchNFS = (n.nNFSe || "").toLowerCase().includes(query);
        if (!matchFornecedor && !matchNFS) return false;
      }
      return true;
    });

    try {
      const { exportToXlsx } = await import("@/lib/exports/exportXlsx");
      await exportToXlsx(notasFiltradas, filteredTomadas, periodType);
      toast.success("Relatório Excel exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar arquivo Excel.");
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Cockpit Executivo Fiscal</h1>
          <p className="text-xs text-muted-foreground mt-1">Análise consolidada para a diretoria</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            id="file-input-fat"
            type="file"
            accept=".zip"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
          <Button
            disabled={importing}
            onClick={() => !importing && document.getElementById("file-input-fat")?.click()}
            className="flex items-center gap-2 px-4 h-9 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all duration-300 hover:scale-[1.01] cursor-pointer"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress ? `Importando (${progress.done}/${progress.total})` : "Importando..."}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Importar NFS-e (ZIP)
              </>
            )}
          </Button>
        </div>
      </div>

      <ExecutiveInsights insights={combinedInsights} />



      {/* METRICS / KPI GRID */}
      {(() => {
        const hasComparison = prevNotasCount > 0;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCardNew
              label="Faturamento"
              value={fmtBRL(faturamento)}
              trendText={faturamentoTrend?.text || ""}
              isPositive={faturamentoTrend?.isPositive || false}
              subtext="comparado ao período anterior"
              tone="blue"
              showComparison={hasComparison && !!faturamentoTrend}
              hasAnomaly={!!activeCompanyAnomaly}
              anomalyTooltip={activeCompanyAnomaly?.description || ""}
            />
            <KpiCardNew
              label="Plano de Saúde"
              value={fmtBRL(plansFaturamento)}
              trendText={plansTrend?.text || ""}
              isPositive={plansTrend?.isPositive || false}
              subtext="comparado ao período anterior"
              tone="purple"
              showComparison={hasComparison && !!plansTrend}
            />
            <KpiCardNew
              label="Serviços Hospitalares"
              value={fmtBRL(hospFaturamento)}
              trendText={hospTrend?.text || ""}
              isPositive={hospTrend?.isPositive || false}
              subtext="comparado ao período anterior"
              tone="green"
              showComparison={hasComparison && !!hospTrend}
            />
            <KpiCardNew
              label="Notas Emitidas"
              value={notasAtivas.length.toLocaleString("pt-BR")}
              trendText={notasAtivasTrend?.text || ""}
              isPositive={notasAtivasTrend?.isPositive || false}
              subtext="comparado ao período anterior"
              tone="amber"
              showComparison={hasComparison && !!notasAtivasTrend}
            />
          </div>
        );
      })()}

      {/* TAXES & OBLIGATIONS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TAXES SUMMARY PANEL */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300 lg:col-span-8">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 font-semibold">Detalhamento de Impostos & Tributos</h3>
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

        {/* UPCOMING OBLIGATIONS WIDGET */}
        <div className="lg:col-span-4">
          <UpcomingObligationsWidget
            obligations={obligations}
            uniqueMuniCodes={uniqueMuniCodes}
            onConfigChange={() => setObligationsTrigger((prev) => prev + 1)}
          />
        </div>
      </div>

      {/* PRIMARY CHARTS & DETAILS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Faturamento Line Chart */}
        {/* Faturamento Line Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-6 transition-colors duration-300">
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
                        const { setMesFiltro } = useGlobalFilters.getState();
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

        {/* NFS-e Count Line Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-6 transition-colors duration-300">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h3 className="text-xs font-bold text-foreground">Evolução do Número de NFS-e</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Comparativo do número de notas emitidas com o período anterior</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
                <span>Período Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80" />
                <span className="border-b border-dashed border-muted-foreground/60 pb-0.5">Período Anterior</span>
              </div>
            </div>
          </div>

          <div className="h-[280px]">
            {nfseCountChartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={nfseCountChartData}
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
                        const { setMesFiltro } = useGlobalFilters.getState();
                        setMesFiltro(selectedMonth);
                        addActivity(
                          "update",
                          `Mês Selecionado: ${state.activeLabel}`,
                          `Dashboard filtrado para o mês de ${state.activeLabel} via clique no gráfico de contagem.`,
                        );
                        toast.success(`Filtrado pelo mês: ${state.activeLabel}`);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => String(v)}
                  />
                  <Tooltip content={<NfseCountTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="Período Atual"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Período Anterior"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                  />
                </LineChart>
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

          <div className="h-[250px] flex items-center justify-center relative">
            {pjPfData.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupIntoOutros(pjPfData, 3)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={1.5}
                      stroke="var(--color-card)"
                      strokeWidth={3}
                      onMouseEnter={(_, index) => setActivePieIndex1(index)}
                      onMouseLeave={() => setActivePieIndex1(null)}
                      onClick={(data) => {
                        if (data && data.name && data.name !== "Outros") {
                          setTipoClienteFiltro((prev) => (prev === data.name ? "__all__" : (data.name || "")));
                          setCurrentPage(1);
                        }
                      }}
                      className="cursor-pointer outline-none focus:outline-none"
                    >
                      {groupIntoOutros(pjPfData, 3).map((entry, index) => {
                        const colors = ["#6366f1", "#14b8a6", "#ec4899", "#94a3b8"];
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill || colors[index % colors.length]} 
                            opacity={activePieIndex1 === null || activePieIndex1 === index ? 1 : 0.6}
                            style={{
                              transform: activePieIndex1 === index ? 'scale(1.03)' : 'scale(1)',
                              transformOrigin: '50% 50%',
                              transition: 'transform 0.2s ease, opacity 0.2s ease',
                            }}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => {
                        const totalVal = pjPfData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = totalVal > 0 ? ((value / totalVal) * 100).toFixed(1) : "0.0";
                        return [`${fmtBRL(value)} (${pct}%)`, "Faturamento"];
                      }}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
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

          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-border/50 text-xs max-h-[150px] overflow-y-auto pr-1">
            {groupIntoOutros(pjPfData, 3).map((item, idx) => {
              const colors = ["#6366f1", "#14b8a6", "#ec4899", "#94a3b8"];
              const isHovered = activePieIndex1 === idx;
              return (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-1 rounded-lg transition-all ${isHovered ? "bg-muted scale-[1.02]" : ""}`}
                  onMouseEnter={() => setActivePieIndex1(idx)}
                  onMouseLeave={() => setActivePieIndex1(null)}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.fill || colors[idx % colors.length] }} />
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
          <p className="text-[10px] text-muted-foreground mb-4">Plano de Saúde vs. Serviços Hospitalares</p>

          <div className="h-[250px] flex items-center justify-center relative">
            {comparativoServicosData.every((d) => d.value === 0) ? (
              <EmptyState />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupIntoOutros(comparativoServicosData.filter((d) => d.value > 0), 3)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={1.5}
                      stroke="var(--color-card)"
                      strokeWidth={3}
                      onMouseEnter={(_, index) => setActivePieIndex2(index)}
                      onMouseLeave={() => setActivePieIndex2(null)}
                      onClick={(data) => {
                        if (data && data.name && data.name !== "Outros") {
                          const filterVal = data.name === "Plano de Saúde" ? "042201" : "040301";
                          setCServFiltro(cServFiltro === filterVal ? "__all__" : filterVal);
                        }
                      }}
                      className="cursor-pointer outline-none focus:outline-none"
                    >
                      {groupIntoOutros(comparativoServicosData.filter((d) => d.value > 0), 3).map((entry, i) => (
                        <Cell 
                          key={i} 
                          fill={entry.fill || "#94a3b8"} 
                          opacity={activePieIndex2 === null || activePieIndex2 === i ? 1 : 0.6}
                          style={{
                            transform: activePieIndex2 === i ? 'scale(1.03)' : 'scale(1)',
                            transformOrigin: '50% 50%',
                            transition: 'transform 0.2s ease, opacity 0.2s ease',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => {
                        const totalVal = comparativoServicosData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = totalVal > 0 ? ((value / totalVal) * 100).toFixed(1) : "0.0";
                        return [`${fmtBRL(value)} (${pct}%)`, "Faturamento"];
                      }}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
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

          <div className="flex justify-around flex-wrap items-center mt-3 pt-3 border-t border-border/50 text-xs max-h-[150px] overflow-y-auto gap-2">
            {groupIntoOutros(comparativoServicosData.filter((d) => d.value > 0), 3).map((item, idx) => {
              const isHovered = activePieIndex2 === idx;
              return (
                <div 
                  key={idx} 
                  className={`flex flex-col items-center p-1 rounded-lg transition-all cursor-pointer hover:bg-muted/85 ${isHovered ? "bg-muted scale-[1.02]" : ""}`}
                  onMouseEnter={() => setActivePieIndex2(idx)}
                  onMouseLeave={() => setActivePieIndex2(null)}
                  onClick={() => {
                    if (item.name !== "Outros") {
                      const filterVal = item.name === "Plano de Saúde" ? "042201" : "040301";
                      setCServFiltro(cServFiltro === filterVal ? "__all__" : filterVal);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.fill || "#94a3b8" }} />
                    <span className="truncate max-w-[100px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-foreground mt-0.5">{fmtBRL(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-1 h-[300px]">
          <BarChartRanking 
            title="Principais Clientes" 
            subtitle="Top 5 tomadores por volume de faturamento"
            data={topClientesList.map(c => ({ name: c.nome, value: c.total }))}
            color="#ec4899"
          />
        </div>
      </div>

      {/* NFS-e PRIMARY TABLE LIST */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Notas Fiscais Emitidas ({sortedNotas.length.toLocaleString("pt-BR")})
            </h3>
            {tipoClienteFiltro !== "__all__" && (
              <Badge variant="secondary" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center">
                Filtro: {tipoClienteFiltro}
                <button
                  onClick={() => {
                    setTipoClienteFiltro("__all__");
                  }}
                  className="hover:bg-indigo-500/30 rounded-full p-0.5 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer ml-1 font-bold focus:outline-none"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>

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
            <button
              onClick={handleExportExcel}
              disabled={!notasFiltradas.length && (!todasNotasTomadas || !todasNotasTomadas.length)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer border border-emerald-500/25 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
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
                <TableHead className="font-medium text-muted-foreground h-9 text-center no-print">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedNotas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center text-muted-foreground py-12 text-xs">
                    Nenhuma nota fiscal encontrada no banco local. Use o botão "Importar NFS-e (ZIP)" no cabeçalho para começar.
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
                      title={n.codTribNacional ? CategoryLabelService.getFriendlyName(n.codTribNacional) : "—"}
                    >
                      {n.codTribNacional ? CategoryLabelService.getFriendlyName(n.codTribNacional) : "—"}
                    </TableCell>
                    <TableCell className="text-center no-print">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrintNota(n)}
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted"
                        title="Imprimir Recibo"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
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

      {selectedNotaForPrint && (
        <div className="receipt-container hidden print:block">
          <style>{`
            @media print {
              body.print-receipt-mode aside,
              body.print-receipt-mode header,
              body.print-receipt-mode main > *:not(.receipt-container),
              body.print-receipt-mode .no-print {
                display: none !important;
              }
              body.print-receipt-mode .receipt-container {
                display: block !important;
                background: white !important;
                color: black !important;
                padding: 1.5cm !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              }
            }
          `}</style>
          
          <div className="border-2 border-slate-800 p-6 rounded-lg max-w-[800px] mx-auto bg-white text-slate-900 shadow-sm print:shadow-none print:border print:p-4">
            {/* Cabecalho */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase text-slate-900">Comprovante de Serviço (NFS-e)</h1>
                <p className="text-[10px] text-slate-500 mt-1">Smart Fiscal Desk • Documento Auxiliar da NFS-e</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedNotaForPrint.status === "válida" 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 print:bg-white print:text-emerald-900 print:border-emerald-400" 
                    : "bg-rose-50 text-rose-800 border-rose-300 print:bg-white print:text-rose-900 print:border-rose-400"
                }`}>
                  {selectedNotaForPrint.status === "válida" ? "VÁLIDA" : "CANCELADA"}
                </span>
              </div>
            </div>

            {/* Info Basica */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 print:bg-slate-50 print:border-slate-200 text-xs">
              <div>
                <div className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Número NFS-e</div>
                <div className="font-semibold text-slate-900 mt-0.5 font-mono">{selectedNotaForPrint.nNFSe}</div>
              </div>
              <div>
                <div className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Data de Emissão</div>
                <div className="font-semibold text-slate-900 mt-0.5">{formatarData(selectedNotaForPrint.dhEmi)}</div>
              </div>
              <div>
                <div className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Competência</div>
                <div className="font-semibold text-slate-900 mt-0.5">{selectedNotaForPrint.dCompet ? formatarCompetencia(selectedNotaForPrint.dCompet) : "—"}</div>
              </div>
              <div>
                <div className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Valor Bruto</div>
                <div className="font-bold text-indigo-700 mt-0.5 font-mono print:text-slate-900">{fmtBRL(selectedNotaForPrint.valor)}</div>
              </div>
            </div>

            {/* Prestador / Tomador */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-6 mb-6">
              {/* Prestador */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-200">
                <div className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2.5">
                  Prestador de Serviços
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500">Razão Social:</span>
                    <div className="font-bold text-slate-900">{selectedNotaForPrint.nomePrestador || "—"}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">CNPJ:</span>
                    <div className="font-mono text-slate-900 font-semibold">{formatarCnpjCpf(selectedNotaForPrint.cnpjPrestador)}</div>
                  </div>
                </div>
              </div>

              {/* Tomador */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white print:border-slate-200">
                <div className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2.5">
                  Tomador de Serviços
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500">Razão Social / Nome:</span>
                    <div className="font-bold text-slate-900">
                      {selectedNotaForPrint.cliente || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">CNPJ / CPF:</span>
                    <div className="font-mono text-slate-900 font-semibold">
                      {formatarCnpjCpf(selectedNotaForPrint.cnpjCpfCliente)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Descricao do Servico */}
            <div className="border border-slate-200 rounded-lg p-4 mb-6 bg-slate-50/50 print:bg-slate-50/50 text-xs">
              <div className="font-extrabold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2.5">
                Discriminação dos Serviços
              </div>
              <div className="whitespace-pre-line text-slate-800 leading-relaxed font-mono text-[11px]">
                {selectedNotaForPrint.servico || "—"}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="font-semibold text-slate-500 uppercase">Cód. Tributação Nacional:</span>
                  <span className="font-mono font-semibold text-slate-900 ml-1">
                    {selectedNotaForPrint.codTribNacional || "—"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 uppercase">Chave de Acesso:</span>
                  <span className="font-mono font-semibold text-slate-900 ml-1 break-all select-all">
                    {selectedNotaForPrint.chave || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quadro de Retencoes / Valores */}
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs">
              <div className="bg-slate-800 text-white font-bold px-4 py-2 uppercase text-[10px] tracking-wider flex justify-between print:bg-slate-800 print:text-white">
                <span>Detalhamento Financeiro</span>
                <span>Valores</span>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
                <div className="flex justify-between px-4 py-2">
                  <span className="font-medium text-slate-600">Valor Bruto do Serviço</span>
                  <span className="font-bold text-slate-900 font-mono">{fmtBRL(selectedNotaForPrint.valor)}</span>
                </div>

                <div className="px-4 py-2.5 bg-slate-50/50 print:bg-slate-50/50">
                  <div className="font-bold text-[9px] text-slate-500 uppercase tracking-wider mb-2">Retenções na Fonte</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                    <div className="flex justify-between border-r border-slate-100 pr-4">
                      <span className="text-slate-500">ISS Retido ({selectedNotaForPrint.issRetido})</span>
                      <span className="font-mono text-slate-700">
                        {fmtBRL(
                          selectedNotaForPrint.vlrIssRet !== undefined
                            ? selectedNotaForPrint.vlrIssRet
                            : selectedNotaForPrint.vlrIss ?? 0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-r border-slate-100 pr-4">
                      <span className="text-slate-500">PIS</span>
                      <span className="font-mono text-slate-700">{fmtBRL(selectedNotaForPrint.vlrPis ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">COFINS</span>
                      <span className="font-mono text-slate-700">{fmtBRL(selectedNotaForPrint.vlrCofins ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-r border-slate-100 pr-4 pt-1.5 border-t border-slate-100/50">
                      <span className="text-slate-500">IRRF</span>
                      <span className="font-mono text-slate-700">{fmtBRL(selectedNotaForPrint.vlrIrrf ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-r border-slate-100 pr-4 pt-1.5 border-t border-slate-100/50">
                      <span className="text-slate-500">CSLL</span>
                      <span className="font-mono text-slate-700">{fmtBRL(selectedNotaForPrint.vlrCsll ?? 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-100/50">
                      <span className="text-slate-500">INSS</span>
                      <span className="font-mono text-slate-700">{fmtBRL(selectedNotaForPrint.vlrInss ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between px-4 py-3 bg-slate-900/5 print:bg-slate-100/60 text-sm">
                  <span className="font-extrabold text-slate-950 uppercase tracking-wide">Valor Líquido Recebido</span>
                  <span className="font-extrabold text-slate-950 font-mono text-base">
                    {fmtBRL(selectedNotaForPrint.vlrLiquido ?? selectedNotaForPrint.valor)}
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé do comprovante */}
            <div className="text-center text-[9px] text-slate-400 mt-8 pt-4 border-t border-slate-200">
              <p>Smart Fiscal Desk • Processado localmente via XML NFS-e em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
              <p className="mt-1">Este documento é uma representação gráfica simplificada baseada no arquivo XML importado e não substitui a NFS-e original.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
