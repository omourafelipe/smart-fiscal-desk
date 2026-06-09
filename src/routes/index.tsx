import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import JSZip from "jszip";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Building2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Receipt,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Search,
  Calendar,
  Tag,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { db, type NotaFiscal } from "@/lib/db";
import { parseNfseXml } from "@/lib/parseXml";
import {
  parseExcelFile,
  detectColumns,
  mapExcelRows,
  parseExcelOperacao,
  parseExcelStatus,
  normalizeString,
  type ExcelRowData,
} from "@/lib/xlsx-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard NFS-e Nacional | BI Fiscal Multiempresa" },
      {
        name: "description",
        content:
          "Analise faturamento fiscal de NFS-e Nacional (SPED v1.01) com dashboards multiempresa, 100% no navegador.",
      },
      { property: "og:title", content: "Dashboard NFS-e Nacional" },
      {
        property: "og:description",
        content: "BI fiscal multiempresa client-side para NFS-e Nacional.",
      },
    ],
  }),
  component: Dashboard,
});

const COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#10b981",
  "#3b82f6",
];

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

const formatarPeriodo = (periodoStr: string) => {
  if (!periodoStr || periodoStr.length !== 7) return periodoStr;
  const [ano, mes] = periodoStr.split("-");
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  if (mesIndex >= 0 && mesIndex < 12) {
    return `${meses[mesIndex]} de ${ano}`;
  }
  return periodoStr;
};

const formatarMesAnoCurto = (periodoStr: string) => {
  if (!periodoStr || periodoStr.length !== 7) return periodoStr;
  const [ano, mes] = periodoStr.split("-");
  const mesesAbrev = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const mesIndex = parseInt(mes, 10) - 1;
  const anoCurto = ano.slice(-2);
  if (mesIndex >= 0 && mesIndex < 12) {
    return `${mesesAbrev[mesIndex]}/${anoCurto}`;
  }
  return periodoStr;
};

const formatarDiaMes = (dataStr: string) => {
  if (!dataStr || dataStr.length !== 10) return dataStr;
  const parts = dataStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dataStr;
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

const formatarMesAnoFiltro = (periodoStr: string) => {
  if (!periodoStr || periodoStr.length !== 7) return periodoStr;
  const [ano, mes] = periodoStr.split("-");
  return `${mes}/${ano}`;
};

const getServicoDescricao = (codTrib: string) => {
  const code = String(codTrib).trim();
  if (code === "042201" || code === "42201") return "Planos de Saúde";
  if (code === "040301" || code === "40301" || code === "043301" || code === "43301") return "Serviços Hospitalares";
  return code ? `Outros (${code})` : "Sem descrição";
};

interface ConciliationResult {
  rowNumber: number;
  rawKey: string;
  normalizedKey: string;
  nNFSe: string;
  prestador: string;
  rawStatus: string;
  statusExcel: "ativa" | "cancelada";
  statusLocal: "ativa" | "cancelada" | "nao_encontrado";
  statusChanged: boolean;
  notaId?: string;
  rawOperacao?: string;
  issRetidoExcel?: "Sim" | "Não";
  issRetidoLocal?: "Sim" | "Não";
  issRetidoDivergent: boolean;
}

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
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Estados do Conciliador de Planilhas
  const xlsxRef = useRef<HTMLInputElement>(null);
  const [xlsxDragOver, setXlsxDragOver] = useState(false);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxRows, setXlsxRows] = useState<ExcelRowData[]>([]);
  const [xlsxHeaders, setXlsxHeaders] = useState<string[]>([]);
  const [keyCol, setKeyCol] = useState<string>("");
  const [statusCol, setStatusCol] = useState<string>("");
  const [operacaoCol, setOperacaoCol] = useState<string>("");
  const [conciliatedItems, setConciliatedItems] = useState<ConciliationResult[]>([]);
  const [isXlsxProcessing, setIsXlsxProcessing] = useState(false);
  const [conciliatedStats, setConciliatedStats] = useState({
    total: 0,
    updated: 0,
    alreadyCorrect: 0,
    notFound: 0,
  });

  const [empresaFiltro, setEmpresaFiltro] = useState<string>("__all__");
  const [mesFiltro, setMesFiltro] = useState<string>("__all__");
  const [anoFiltro, setAnoFiltro] = useState<string>("__all__");
  const [cServFiltro, setCServFiltro] = useState<string>("__all__");
  const [searchCliente, setSearchCliente] = useState<string>("");
  const [searchGrupoCnpj, setSearchGrupoCnpj] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente]);

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    todasNotas?.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [todasNotas]);

  const cnpjsGrupoMap = useMemo(() => {
    const map = new Map<string, string>();
    empresas.forEach((e) => {
      map.set(e.cnpj.replace(/\D/g, ""), e.nome);
    });
    return map;
  }, [empresas]);

  const checkIntergrupo = useCallback((cnpjCpfCliente: string) => {
    const cleanDoc = String(cnpjCpfCliente ?? "").replace(/\D/g, "");
    if (cnpjsGrupoMap.has(cleanDoc)) {
      return cnpjsGrupoMap.get(cleanDoc) || "";
    }
    return null;
  }, [cnpjsGrupoMap]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    todasNotas?.forEach((n) => {
      if (n.dhEmi) {
        const y = n.dhEmi.slice(0, 4); // YYYY
        if (y.length === 4) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [todasNotas]);

  const notasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      if (mesFiltro !== "__all__" && n.dhEmi.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && n.dhEmi.slice(0, 4) !== anoFiltro) return false;
      if (cServFiltro !== "__all__") {
        const c1 = String(n.codTribNacional || "").replace(/^0+/, "");
        const c2 = String(cServFiltro).replace(/^0+/, "");
        const isHospitalarMatch = 
          (c2 === "43301" || c2 === "40301") && 
          (c1 === "43301" || c1 === "40301");
        if (c1 !== c2 && !isHospitalarMatch) return false;
      }
      if (searchCliente && !n.cliente.toLowerCase().includes(searchCliente.toLowerCase()))
        return false;
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente]);

  const notasAtivas = notasFiltradas.filter((n) => n.status === "ativa");
  const notasCanceladas = notasFiltradas.filter((n) => n.status === "cancelada");
  const faturamento = notasAtivas.reduce((sum, n) => sum + n.valor, 0);
  const ticketMedio = notasAtivas.length ? faturamento / notasAtivas.length : 0;

  // Cálculos de tributos
  const issRetidoTotal = useMemo(() => {
    return notasAtivas.reduce((sum, n) => sum + (n.issRetido === "Sim" ? n.vlrIss : 0), 0);
  }, [notasAtivas]);

  const issARecolherTotal = useMemo(() => {
    return notasAtivas.reduce((sum, n) => sum + (n.issRetido !== "Sim" ? n.vlrIss : 0), 0);
  }, [notasAtivas]);

  const pisTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrPis ?? 0), 0), [notasAtivas]);
  const cofinsTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrCofins ?? 0), 0), [notasAtivas]);
  const csllTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrCsll ?? 0), 0), [notasAtivas]);
  const irrfTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrIrrf ?? 0), 0), [notasAtivas]);
  const inssTotal = useMemo(() => notasAtivas.reduce((sum, n) => sum + (n.vlrInss ?? 0), 0), [notasAtivas]);

  const tributosFederaisTotal = useMemo(() => {
    return pisTotal + cofinsTotal + csllTotal + irrfTotal + inssTotal;
  }, [pisTotal, cofinsTotal, csllTotal, irrfTotal, inssTotal]);

  // Bar chart: evolução mensal (ou diária se período específico)
  const barData = useMemo(() => {
    const byKey = new Map<string, number>();
    const useDay = anoFiltro !== "__all__" && mesFiltro !== "__all__";
    notasAtivas.forEach((n) => {
      if (!n.dhEmi) return;
      const key = useDay ? n.dhEmi.slice(0, 10) : n.dhEmi.slice(0, 7);
      byKey.set(key, (byKey.get(key) ?? 0) + n.valor);
    });
    return Array.from(byKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: useDay ? formatarDiaMes(k) : formatarMesAnoCurto(k),
        valor: v,
      }));
  }, [notasAtivas, mesFiltro, anoFiltro]);

  // Pie chart
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    const isGlobal = empresaFiltro === "__all__";
    notasAtivas.forEach((n) => {
      const key = isGlobal
        ? n.nomePrestador || n.cnpjPrestador
        : getServicoDescricao(n.codTribNacional);
      map.set(key, (map.get(key) ?? 0) + n.valor);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [notasAtivas, empresaFiltro]);

  const pieTitle =
    empresaFiltro === "__all__" ? "Faturamento por Empresa" : "Top Serviços por Faturamento";

  // Faturamento PJ vs PF
  const pjPfData = useMemo(() => {
    let pjTotal = 0;
    let pfTotal = 0;

    notasAtivas.forEach((n) => {
      const cleanKey = String(n.cnpjCpfCliente ?? "").replace(/\D/g, "");
      if (cleanKey.length === 14) {
        pjTotal += n.valor;
      } else if (cleanKey.length === 11) {
        pfTotal += n.valor;
      } else {
        // Fallback: se tiver mais que 11 caracteres, assume PJ
        if (cleanKey.length > 11) {
          pjTotal += n.valor;
        } else if (cleanKey.length > 0) {
          pfTotal += n.valor;
        } else {
          pjTotal += n.valor;
        }
      }
    });

    const data = [];
    if (pjTotal > 0) {
      data.push({ name: "Pessoa Jurídica (PJ)", value: pjTotal });
    }
    if (pfTotal > 0) {
      data.push({ name: "Pessoa Física (PF)", value: pfTotal });
    }
    return data;
  }, [notasAtivas]);

  // Comparativo 042201 x 040301
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
      { name: "Serviços Hospitalares", value: hospitaisTotal, fill: "#14b8a6" }
    ];
  }, [notasAtivas]);

  // Ordenação de notas filtradas
  const sortedNotas = useMemo(() => {
    return [...notasFiltradas].sort((a, b) => (b.dhEmi || "").localeCompare(a.dhEmi || ""));
  }, [notasFiltradas]);

  // Paginação
  const paginatedNotas = useMemo(() => {
    return sortedNotas.slice((currentPage - 1) * 100, currentPage * 100);
  }, [sortedNotas, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(sortedNotas.length / 100);
  }, [sortedNotas]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
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
    }
    setProgress(null);
    setImporting(false);
    toast.success(
      `${allNotas.length} nota(s) importada(s). ${skipped ? skipped + " ignorada(s)." : ""}`,
    );
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const clearDb = async () => {
    if (confirm("Apagar TODA a base de dados local? Esta ação não pode ser desfeita.")) {
      await db.notas.clear();
      toast.success("Base de dados local apagada.");
    }
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
      n.status === "ativa" ? "Ativa" : "Cancelada",
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

  const runConciliation = useCallback(
    async (
      rows: ExcelRowData[],
      kCol: string,
      sCol: string,
      opCol: string,
      localNotas: NotaFiscal[],
    ) => {
      setIsXlsxProcessing(true);
      const results: ConciliationResult[] = [];

      let updated = 0;
      let alreadyCorrect = 0;
      let notFound = 0;

      // Create a fast map of normalized chave to local note
      const localMap = new Map<string, NotaFiscal>();
      localNotas.forEach((n) => {
        if (n.chave) {
          localMap.set(n.chave, n);
        }
      });

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rawKey = String(row[kCol] ?? "").trim();
        const key = rawKey.replace(/\D/g, "");
        if (!key) continue;

        const rawStatus = String(row[sCol] ?? "").trim();
        const statusExcel = parseExcelStatus(rawStatus);

        const rawOperacao = opCol ? String(row[opCol] ?? "").trim() : "";
        const issRetidoExcel = parseExcelOperacao(rawOperacao);

        const local = localMap.get(key);
        const issRetidoLocal = local ? (local.issRetido as "Sim" | "Não") : undefined;

        const statusChanged = local ? local.status !== statusExcel : false;
        const issRetidoDivergent =
          local && issRetidoExcel !== undefined ? issRetidoLocal !== issRetidoExcel : false;

        const res: ConciliationResult = {
          rowNumber: idx + 2,
          rawKey,
          normalizedKey: key,
          nNFSe: local?.nNFSe || "—",
          prestador: local?.nomePrestador || "—",
          rawStatus,
          statusExcel,
          statusLocal: local ? local.status : "nao_encontrado",
          statusChanged,
          notaId: local?.id,
          rawOperacao,
          issRetidoExcel,
          issRetidoLocal,
          issRetidoDivergent,
        };

        if (!local) {
          notFound++;
        } else if (res.statusChanged || res.issRetidoDivergent) {
          updated++;
        } else {
          alreadyCorrect++;
        }

        results.push(res);
      }

      setConciliatedItems(results);
      setConciliatedStats({
        total: results.length,
        updated,
        alreadyCorrect,
        notFound,
      });
      setIsXlsxProcessing(false);
    },
    [],
  );

  const processXlsxFile = async (file: File) => {
    setIsXlsxProcessing(true);
    setXlsxFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const { headers, rows } = parseExcelFile(buffer);
      setXlsxHeaders(headers);
      setXlsxRows(rows);

      // Auto-detect columns
      const { keyColumn, statusColumn } = detectColumns(headers);
      const kCol = keyColumn || headers[0] || "";
      const sCol = statusColumn || headers[1] || "";
      setKeyCol(kCol);
      setStatusCol(sCol);

      // Auto-detect "Operação" column
      const opCol =
        headers.find(
          (h) =>
            normalizeString(h).includes("operacao") ||
            normalizeString(h).includes("operação") ||
            normalizeString(h).includes("colunag") ||
            normalizeString(h).includes("operac"),
        ) || (headers.length >= 7 ? headers[6] : "");
      setOperacaoCol(opCol);

      if (kCol && sCol && todasNotas) {
        runConciliation(rows, kCol, sCol, opCol, todasNotas);
      }
      toast.success(`Planilha "${file.name}" carregada com ${rows.length} linhas.`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ler arquivo Excel.");
    } finally {
      setIsXlsxProcessing(false);
    }
  };

  const onXlsxDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setXlsxDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      processXlsxFile(e.dataTransfer.files[0]);
    }
  };

  const applyUpdates = async () => {
    const changes = conciliatedItems.filter(
      (item) => (item.statusChanged || item.issRetidoDivergent) && item.notaId,
    );
    if (changes.length === 0) {
      toast.info("Nenhuma divergência encontrada para atualizar.");
      return;
    }

    try {
      await db.transaction("rw", db.notas, async () => {
        for (const item of changes) {
          if (item.notaId) {
            const updates: Partial<NotaFiscal> = {};
            if (item.statusChanged) updates.status = item.statusExcel;
            if (item.issRetidoDivergent && item.issRetidoExcel)
              updates.issRetido = item.issRetidoExcel;

            if (Object.keys(updates).length > 0) {
              await db.notas.update(item.notaId, updates);
            }
          }
        }
      });
      toast.success("Divergências de Status e/ou ISS retificadas no banco de dados local!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar as atualizações.");
    }
  };

  const exportValidationCsv = () => {
    const headers = [
      "Linha Planilha",
      "Chave de Acesso",
      "Chave Normalizada",
      "Nº NFS-e",
      "Prestador",
      "Status Planilha",
      "Status Local",
      "Operação Planilha",
      "ISS Retido Planilha",
      "ISS Retido Local",
      "Divergente",
    ];
    const rows = conciliatedItems.map((item) => [
      item.rowNumber,
      item.rawKey,
      item.normalizedKey,
      item.nNFSe,
      item.prestador,
      item.statusExcel,
      item.statusLocal === "nao_encontrado" ? "Não Encontrado" : item.statusLocal,
      item.rawOperacao || "—",
      item.issRetidoExcel || "—",
      item.issRetidoLocal || "—",
      item.statusChanged || item.issRetidoDivergent ? "Sim" : "Não",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (xlsxRows.length > 0 && keyCol && statusCol && todasNotas) {
      runConciliation(xlsxRows, keyCol, statusCol, operacaoCol, todasNotas);
    }
  }, [todasNotas, xlsxRows, keyCol, statusCol, operacaoCol, runConciliation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <Toaster richColors position="top-right" />

      {/* Header */}
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Dashboard NFS-e Nacional</h1>
              <p className="text-xs text-muted-foreground">SPED v1.01 · BI Fiscal Multiempresa</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="w-[260px]">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as Empresas (Total do Grupo)</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.cnpj} value={e.cnpj}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os meses</SelectItem>
                {mesesOpcoes.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={anoFiltro} onValueChange={setAnoFiltro}>
              <SelectTrigger className="w-[110px]">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os anos</SelectItem>
                {anos.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cServFiltro} onValueChange={setCServFiltro}>
              <SelectTrigger className="w-[220px]">
                <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Serviços</SelectItem>
                <SelectItem value="042201">042201 - Planos de Saúde</SelectItem>
                <SelectItem value="040301">040301 - Serviços Hospitalares</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex justify-start">
            <TabsList className="grid w-full max-w-[440px] grid-cols-2 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" /> BI & Dashboards
              </TabsTrigger>
              <TabsTrigger value="conciliation" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Validador Sintético (.xlsx)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6 outline-none">
            {/* Upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
                  : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
              <div className="flex flex-col items-center gap-2">
                {importing ? (
                  <>
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                    <p className="font-semibold">Processando…</p>
                    {progress && (
                      <p className="text-sm text-muted-foreground">
                        {progress.done} / {progress.total} XMLs
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-indigo-600" />
                    </div>
                    <p className="font-semibold">
                      Arraste arquivos .zip aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Suporta múltiplos .zip contendo XMLs NFS-e Nacional (SPED v1.01)
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Faturamento Válido"
                value={fmtBRL(faturamento)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="indigo"
              />
              <KpiCard
                label="Ticket Médio"
                value={fmtBRL(ticketMedio)}
                icon={<Receipt className="h-5 w-5" />}
                tone="purple"
              />
              <KpiCard
                label="Notas Ativas"
                value={notasAtivas.length.toLocaleString("pt-BR")}
                icon={<CheckCircle2 className="h-5 w-5" />}
                tone="emerald"
              />
              <KpiCard
                label="Canceladas / Substituídas"
                value={notasCanceladas.length.toLocaleString("pt-BR")}
                icon={<XCircle className="h-5 w-5" />}
                tone="rose"
              />
            </div>

            {/* Resumo de Tributos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="ISS Retido"
                value={fmtBRL(issRetidoTotal)}
                icon={<Building2 className="h-5 w-5" />}
                tone="purple"
                subtext="Retido na fonte pelo tomador"
              />
              <KpiCard
                label="ISS a Recolher"
                value={fmtBRL(issARecolherTotal)}
                icon={<Receipt className="h-5 w-5" />}
                tone="indigo"
                subtext="Recolhimento próprio do prestador"
              />
              <KpiCard
                label="Demais Tributos (Federais)"
                value={fmtBRL(tributosFederaisTotal)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="emerald"
                subtext={`PIS: ${fmtBRL(pisTotal)} · COFINS: ${fmtBRL(cofinsTotal)} · CSLL: ${fmtBRL(csllTotal)} · IR: ${fmtBRL(irrfTotal)} · INSS: ${fmtBRL(inssTotal)}`}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-12 xl:col-span-6">
                <CardHeader>
                  <CardTitle className="text-base">Evolução do Faturamento</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {barData.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          tickFormatter={(v) =>
                            v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                          }
                        />
                        <Tooltip
                          formatter={(v) => fmtBRL(Number(v))}
                          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                        />
                        <Bar dataKey="valor" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-6 xl:col-span-6">
                <CardHeader>
                  <CardTitle className="text-base">Comparativo: Planos de Saúde x Serviços Hospitalares</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {comparativoServicosData.every((d) => d.value === 0) ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={comparativoServicosData.filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {comparativoServicosData
                            .filter((d) => d.value > 0)
                            .map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-6 xl:col-span-6">
                <CardHeader>
                  <CardTitle className="text-base">{pieTitle}</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {pieData.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11 }}
                          formatter={(value: string) =>
                            value.length > 22 ? value.slice(0, 22) + "…" : value
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-6 xl:col-span-6">
                <CardHeader>
                  <CardTitle className="text-base">Faturamento PJ vs PF</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {pjPfData.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pjPfData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {pjPfData.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "#6366f1" : "#ec4899"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notas Fiscais ({notasFiltradas.length.toLocaleString("pt-BR")})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCsv}
                    disabled={!notasFiltradas.length}
                  >
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearDb}>
                    <Trash2 className="h-4 w-4 mr-2" /> Limpar Base
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center justify-between w-full">
                  <div className="flex flex-1 gap-2 items-center w-full sm:max-w-md flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por cliente..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        className="pl-8"
                      />
                    </div>

                    <Select value={mesFiltro} onValueChange={setMesFiltro}>
                      <SelectTrigger className="w-[140px] h-9">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os meses</SelectItem>
                        {mesesOpcoes.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                      <SelectTrigger className="w-[110px] h-9">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os anos</SelectItem>
                        {anos.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border max-h-[600px] overflow-auto relative">
                  <Table className="min-w-[1600px]" wrapperClassName="overflow-visible">
                    <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <TableRow>
                        <TableHead>Nº NFS</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>CNPJ/CPF Cliente</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Vlr. Serviço</TableHead>
                        <TableHead className="text-right">Vlr. Líquido</TableHead>
                        <TableHead className="text-right">Vlr. ISS</TableHead>
                        <TableHead className="text-center">ISS Retido?</TableHead>
                        <TableHead className="text-right">Vlr. PIS</TableHead>
                        <TableHead className="text-right">Vlr. COFINS</TableHead>
                        <TableHead className="text-right">Vlr. CSLL</TableHead>
                        <TableHead className="text-right">Vlr. IRRF</TableHead>
                        <TableHead className="text-right">Vlr. INSS</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedNotas.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={16}
                            className="text-center text-muted-foreground py-8"
                          >
                            Nenhuma nota encontrada. Envie um .zip para começar.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedNotas.map((n) => (
                          <TableRow key={n.id}>
                            <TableCell className="font-mono text-xs">{n.nNFSe}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatarData(n.dhEmi)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatarCompetencia(n.dCompet)}
                            </TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">
                              {formatarCnpjCpf(n.cnpjCpfCliente)}
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate" title={n.cliente}>
                              {n.cliente}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.valor)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrLiquido ?? n.valor)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrIss ?? 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              {n.issRetido === "Sim" ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Sim
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-50 text-slate-600 border-slate-200"
                                >
                                  Não
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrPis ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrCofins ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrCsll ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrIrrf ?? 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                              {fmtBRL(n.vlrInss ?? 0)}
                            </TableCell>
                            <TableCell
                              className="text-xs max-w-[180px] truncate"
                              title={
                                n.codTribNacional
                                  ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}`
                                  : "—"
                              }
                            >
                              {n.codTribNacional
                                ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {n.status === "ativa" ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                  Ativa
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                                  Cancelada
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 pt-4 border-t mt-4 flex-wrap text-sm text-muted-foreground">
                    <div>
                      Exibindo {Math.min(sortedNotas.length, (currentPage - 1) * 100 + 1)} a{" "}
                      {Math.min(sortedNotas.length, currentPage * 100)} de {sortedNotas.length} notas
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      >
                        Anterior
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(p)}
                          className={currentPage === p ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
                        >
                          {p}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conciliation" className="space-y-6 outline-none">
            {/* Dropzone planilha */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setXlsxDragOver(true);
              }}
              onDragLeave={() => setXlsxDragOver(false)}
              onDrop={onXlsxDrop}
              onClick={() => xlsxRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                xlsxDragOver
                  ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
                  : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={xlsxRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && processXlsxFile(e.target.files[0])}
              />
              <div className="flex flex-col items-center gap-2">
                {isXlsxProcessing ? (
                  <>
                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                    <p className="font-semibold">Processando Planilha…</p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
                    </div>
                    {xlsxFile ? (
                      <>
                        <p className="font-semibold text-indigo-600">{xlsxFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Clique ou arraste outro arquivo para substituir
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">
                          Arraste a planilha de relatório (.xlsx) aqui ou clique para selecionar
                        </p>
                        <p className="text-sm text-muted-foreground">
                          O arquivo Excel deve conter as colunas de "Chave de Acesso" e
                          "Situação/Status"
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Resultado da conciliação */}
            {xlsxRows.length > 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Configuração de Colunas */}
                  <Card className="md:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        Mapeamento de Colunas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Coluna da Chave de Acesso
                        </label>
                        <Select value={keyCol} onValueChange={(val) => setKeyCol(val)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {xlsxHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Coluna da Situação/Status
                        </label>
                        <Select value={statusCol} onValueChange={(val) => setStatusCol(val)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {xlsxHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">
                          Coluna de Operação (ISS Retido)
                        </label>
                        <Select value={operacaoCol} onValueChange={(val) => setOperacaoCol(val)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {xlsxHeaders.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estatísticas de Conciliação */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Divergentes / Atualizáveis
                          </p>
                          <p className="text-3xl font-extrabold mt-2 text-indigo-600">
                            {conciliatedStats.updated}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-indigo-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Já Conciliadas
                          </p>
                          <p className="text-3xl font-extrabold mt-2 text-emerald-600">
                            {conciliatedStats.alreadyCorrect}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Check className="h-5 w-5 text-emerald-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Não Encontradas localmente
                          </p>
                          <p className="text-3xl font-extrabold mt-2 text-rose-500">
                            {conciliatedStats.notFound}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                          <XCircle className="h-5 w-5 text-rose-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Total Processado
                          </p>
                          <p className="text-3xl font-extrabold mt-2">{conciliatedStats.total}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <FileSpreadsheet className="h-5 w-5 text-slate-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Tabela de Resultados */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      Resultados da Validação
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={applyUpdates}
                        disabled={conciliatedStats.updated === 0}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-lg"
                      >
                        <Check className="h-4 w-4 mr-2" /> Aplicar Atualizações no Banco
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportValidationCsv}
                        disabled={conciliatedItems.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" /> Exportar Divergências (CSV)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Linha</TableHead>
                            <TableHead>Chave de Acesso</TableHead>
                            <TableHead>Nº NFS-e</TableHead>
                            <TableHead>Prestador</TableHead>
                            <TableHead>Status (Planilha | Local)</TableHead>
                            <TableHead>ISS Retido (Planilha | Local)</TableHead>
                            <TableHead>Resultado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conciliatedItems.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-8 text-muted-foreground"
                              >
                                Mapeie as colunas de Chave e Status acima para visualizar os dados.
                              </TableCell>
                            </TableRow>
                          ) : (
                            conciliatedItems.map((item, idx) => (
                              <TableRow
                                key={idx}
                                className={
                                  item.statusChanged || item.issRetidoDivergent
                                    ? "bg-amber-50/40 hover:bg-amber-50/60"
                                    : ""
                                }
                              >
                                <TableCell className="text-xs font-mono">
                                  {item.rowNumber}
                                </TableCell>
                                <TableCell
                                  className="text-xs font-mono max-w-[220px] truncate"
                                  title={item.rawKey}
                                >
                                  {item.rawKey}
                                </TableCell>
                                <TableCell className="text-xs font-mono">{item.nNFSe}</TableCell>
                                <TableCell
                                  className="text-xs max-w-[150px] truncate"
                                  title={item.prestador}
                                >
                                  {item.prestador}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex items-center gap-1">
                                    <Badge
                                      className={
                                        item.statusExcel === "ativa"
                                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                          : "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200"
                                      }
                                    >
                                      {item.statusExcel === "ativa" ? "Ativa" : "Cancelada"}
                                    </Badge>
                                    <span className="text-muted-foreground">|</span>
                                    {item.statusLocal === "nao_encontrado" ? (
                                      <span className="text-slate-400 text-xs">Inexistente</span>
                                    ) : (
                                      <Badge
                                        className={
                                          item.statusLocal === "ativa"
                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                            : "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200"
                                        }
                                      >
                                        {item.statusLocal === "ativa" ? "Ativa" : "Cancelada"}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex items-center gap-1">
                                    {item.issRetidoExcel ? (
                                      <Badge
                                        variant="outline"
                                        className={
                                          item.issRetidoExcel === "Sim"
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-slate-50 text-slate-600 border-slate-200"
                                        }
                                      >
                                        {item.issRetidoExcel}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                    <span className="text-muted-foreground">|</span>
                                    {item.statusLocal === "nao_encontrado" ? (
                                      <span className="text-slate-400 text-xs">Inexistente</span>
                                    ) : item.issRetidoLocal ? (
                                      <Badge
                                        variant="outline"
                                        className={
                                          item.issRetidoLocal === "Sim"
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-slate-50 text-slate-600 border-slate-200"
                                        }
                                      >
                                        {item.issRetidoLocal}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-semibold">
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-rose-500">Inexistente no Banco</span>
                                  ) : item.statusChanged || item.issRetidoDivergent ? (
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      {item.statusChanged && item.issRetidoDivergent
                                        ? "Status e ISS divergentes"
                                        : item.statusChanged
                                          ? "Status divergente"
                                          : "ISS Retido divergente"}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <Check className="h-3.5 w-3.5" /> Conciliado
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground py-6 mt-6 border-t">
          🔒 Processamento 100% local — seus XMLs e planilhas nunca saem do seu navegador.
        </p>
      </main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "indigo" | "purple" | "emerald" | "rose";
  subtext?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/30",
    purple: "from-purple-500 to-fuchsia-600 shadow-purple-500/30",
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
    rose: "from-rose-500 to-red-600 shadow-rose-500/30",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-2">{value}</p>
            {subtext && <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{subtext}</p>}
          </div>
          <div
            className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center shadow-lg`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Sem dados para os filtros atuais.
    </div>
  );
}
