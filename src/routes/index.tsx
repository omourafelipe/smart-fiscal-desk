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
  Menu,
  Bell,
  Star,
  Clock,
  Sparkles,
  Settings,
  User,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  Filter,
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

  // Layout & Navigation States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "conciliation">("dashboard");

  // Activity Log Type & State
  interface ActivityLogItem {
    id: string;
    type: "upload" | "conciliation" | "clear" | "update";
    title: string;
    description: string;
    time: Date;
  }

  const [activities, setActivities] = useState<ActivityLogItem[]>([
    {
      id: "init",
      type: "update",
      title: "Sistema Inicializado",
      description: "Banco de dados local carregado com sucesso.",
      time: new Date(),
    }
  ]);

  const addActivity = useCallback((type: ActivityLogItem["type"], title: string, description: string) => {
    setActivities(prev => [
      {
        id: Math.random().toString(36).substring(7),
        type,
        title,
        description,
        time: new Date(),
      },
      ...prev.slice(0, 19)
    ]);
  }, []);

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

  // regime selector: Competência vs Emissão
  const [periodType, setPeriodType] = useState<"competencia" | "emissao">("competencia");

  const getDateField = useCallback((n: NotaFiscal) => {
    if (periodType === "competencia" && n.dCompet) {
      return n.dCompet.split("T")[0]; // ensure YYYY-MM-DD
    }
    return (n.dhEmi || "").split("T")[0];
  }, [periodType]);

  const anos = useMemo(() => {
    const set = new Set<string>();
    todasNotas?.forEach((n) => {
      const dateStr = getDateField(n);
      if (dateStr) {
        const y = dateStr.slice(0, 4); // YYYY
        if (y.length === 4) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [todasNotas, getDateField]);

  const notasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      const dateStr = getDateField(n);
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      if (mesFiltro !== "__all__" && dateStr.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
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
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, getDateField]);

  const notasAtivas = notasFiltradas.filter((n) => n.status === "ativa");
  const notasCanceladas = notasFiltradas.filter((n) => n.status === "cancelada");
  const faturamento = notasAtivas.reduce((sum, n) => sum + n.valor, 0);
  const ticketMedio = notasAtivas.length ? faturamento / notasAtivas.length : 0;

  // Comparative period trend calculations (unfiltered by status)
  const prevNotasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    
    let prevAno = anoFiltro;
    let prevMes = mesFiltro;
    
    if (anoFiltro !== "__all__") {
      if (mesFiltro !== "__all__") {
        let m = parseInt(mesFiltro, 10);
        let y = parseInt(anoFiltro, 10);
        m--;
        if (m === 0) {
          m = 12;
          y--;
        }
        prevMes = String(m).padStart(2, "0");
        prevAno = String(y);
      } else {
        let y = parseInt(anoFiltro, 10);
        prevAno = String(y - 1);
      }
    } else {
      if (mesFiltro !== "__all__" && mesFiltro !== undefined) {
        let m = parseInt(mesFiltro, 10);
        m--;
        if (m === 0) m = 12;
        prevMes = String(m).padStart(2, "0");
      } else {
        if (anos.length >= 1) {
          prevAno = String(parseInt(anos[0], 10) - 1);
        }
      }
    }

    return todasNotas.filter((n) => {
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (prevAno !== "__all__" && dateStr.slice(0, 4) !== prevAno) return false;
      if (prevMes !== "__all__" && dateStr.slice(5, 7) !== prevMes) return false;
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
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField]);

  const prevNotasAtivas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => n.status === "ativa");
  }, [prevNotasFiltradas]);

  const prevNotasCanceladas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => n.status === "cancelada");
  }, [prevNotasFiltradas]);

  const prevFaturamento = useMemo(() => {
    return prevNotasAtivas.reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const prevNotasCount = prevNotasAtivas.length;

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { percent: 0, isPositive: true, text: "0%" };
    const diff = ((current - previous) / previous) * 100;
    const isPositive = diff >= 0;
    return {
      percent: Math.abs(diff),
      isPositive,
      text: `${isPositive ? "+" : ""}${diff.toFixed(1)}%`
    };
  };

  const faturamentoTrend = useMemo(() => getTrend(faturamento, prevFaturamento), [faturamento, prevFaturamento]);
  const notasAtivasTrend = useMemo(() => getTrend(notasAtivas.length, prevNotasCount), [notasAtivas.length, prevNotasCount]);

  // Cancelamento & Substituição Rates & Trends
  const valorCancelado = useMemo(() => {
    return notasCanceladas.reduce((sum, n) => sum + n.valor, 0);
  }, [notasCanceladas]);

  const cancelRate = useMemo(() => {
    const totalCount = notasFiltradas.length;
    return totalCount ? (notasCanceladas.length / totalCount) * 100 : 0;
  }, [notasCanceladas, notasFiltradas]);

  const prevValorCancelado = useMemo(() => {
    return prevNotasCanceladas.reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasCanceladas]);

  const prevCancelRate = useMemo(() => {
    const totalCount = prevNotasFiltradas.length;
    return totalCount ? (prevNotasCanceladas.length / totalCount) * 100 : 0;
  }, [prevNotasCanceladas, prevNotasFiltradas]);

  const cancelRateTrend = useMemo(() => getTrend(cancelRate, prevCancelRate), [cancelRate, prevCancelRate]);

  // Plano de Saúde (042201) Faturamento and Trend
  const plansFaturamento = useMemo(() => {
    return notasAtivas
      .filter((n) => String(n.codTribNacional || "").replace(/^0+/, "") === "42201")
      .reduce((sum, n) => sum + n.valor, 0);
  }, [notasAtivas]);

  const prevPlansFaturamento = useMemo(() => {
    return prevNotasAtivas
      .filter((n) => String(n.codTribNacional || "").replace(/^0+/, "") === "42201")
      .reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const plansTrend = useMemo(() => getTrend(plansFaturamento, prevPlansFaturamento), [plansFaturamento, prevPlansFaturamento]);

  // Serviços Hospitalares (040301, 043301) Faturamento and Trend
  const hospFaturamento = useMemo(() => {
    return notasAtivas
      .filter((n) => {
        const c = String(n.codTribNacional || "").replace(/^0+/, "");
        return c === "40301" || c === "43301";
      })
      .reduce((sum, n) => sum + n.valor, 0);
  }, [notasAtivas]);

  const prevHospFaturamento = useMemo(() => {
    return prevNotasAtivas
      .filter((n) => {
        const c = String(n.codTribNacional || "").replace(/^0+/, "");
        return c === "40301" || c === "43301";
      })
      .reduce((sum, n) => sum + n.valor, 0);
  }, [prevNotasAtivas]);

  const hospTrend = useMemo(() => getTrend(hospFaturamento, prevHospFaturamento), [hospFaturamento, prevHospFaturamento]);

  // Main 12-month evolution chart (ignores mesFiltro, aggregates complete year)
  const notasParaGrafico = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (n.status !== "ativa") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
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
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, getDateField]);

  const prevNotasParaGrafico = useMemo(() => {
    if (!todasNotas) return [];
    let prevAno = anoFiltro;
    if (anoFiltro !== "__all__") {
      let y = parseInt(anoFiltro, 10);
      prevAno = String(y - 1);
    } else {
      if (anos.length >= 1) {
        prevAno = String(parseInt(anos[0], 10) - 1);
      }
    }

    return todasNotas.filter((n) => {
      if (n.status !== "ativa") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      const dateStr = getDateField(n);
      if (prevAno !== "__all__" && dateStr.slice(0, 4) !== prevAno) return false;
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
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField]);

  const lineChartData = useMemo(() => {
    const currentMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    
    notasParaGrafico.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7); // Always aggregate by Month (MM)
      currentMap.set(key, (currentMap.get(key) ?? 0) + n.valor);
    });
    
    prevNotasParaGrafico.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7); // Always aggregate by Month (MM)
      prevMap.set(key, (prevMap.get(key) ?? 0) + n.valor);
    });
    
    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = [];
    for (let i = 1; i <= 12; i++) {
      const mesStr = String(i).padStart(2, "0");
      data.push({
        label: mesesAbrev[i - 1],
        "Período Atual": currentMap.get(mesStr) ?? 0,
        "Período Anterior": prevMap.get(mesStr) ?? 0,
      });
    }
    return data;
  }, [notasParaGrafico, prevNotasParaGrafico, getDateField]);

  // Top services by faturamento (matches Traffic by Website style)
  const topServicesList = useMemo(() => {
    const map = new Map<string, { cod: string; desc: string; total: number }>();
    notasAtivas.forEach((n) => {
      const cod = n.codTribNacional || "";
      const key = cod || "Outros";
      const desc = getServicoDescricao(cod);
      const curr = map.get(key) || { cod, desc, total: 0 };
      curr.total += n.valor;
      map.set(key, curr);
    });
    
    const sorted = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
      
    return sorted.map((s) => ({
      name: s.desc,
      value: s.total,
      percentage: faturamento > 0 ? (s.total / faturamento) * 100 : 0
    }));
  }, [notasAtivas, faturamento]);

  // Top clients by faturamento (matches Top Selling Products table style)
  const topClientesList = useMemo(() => {
    const map = new Map<string, { cnpjCpf: string; nome: string; total: number; count: number }>();
    notasAtivas.forEach((n) => {
      const key = n.cnpjCpfCliente || "Desconhecido";
      const curr = map.get(key) || { cnpjCpf: key, nome: n.cliente || "Desconhecido", total: 0, count: 0 };
      curr.total += n.valor;
      curr.count += 1;
      map.set(key, curr);
    });
    
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [notasAtivas]);

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
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = useDay ? dateStr.slice(0, 10) : dateStr.slice(0, 7);
      byKey.set(key, (byKey.get(key) ?? 0) + n.valor);
    });
    return Array.from(byKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: useDay ? formatarDiaMes(k) : formatarMesAnoCurto(k),
        valor: v,
      }));
  }, [notasAtivas, mesFiltro, anoFiltro, getDateField]);

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
    let pjCount = 0;
    let pfCount = 0;

    notasAtivas.forEach((n) => {
      const cleanKey = String(n.cnpjCpfCliente ?? "").replace(/\D/g, "");
      if (cleanKey.length === 14) {
        pjTotal += n.valor;
        pjCount++;
      } else if (cleanKey.length === 11) {
        pfTotal += n.valor;
        pfCount++;
      } else {
        // Fallback: se tiver mais que 11 caracteres, assume PJ
        if (cleanKey.length > 11) {
          pjTotal += n.valor;
          pjCount++;
        } else if (cleanKey.length > 0) {
          pfTotal += n.valor;
          pfCount++;
        } else {
          pjTotal += n.valor;
          pjCount++;
        }
      }
    });

    const data = [];
    if (pjTotal > 0 || pjCount > 0) {
      data.push({
        name: "Pessoa Jurídica (Corporate/PME)",
        value: pjTotal,
        count: pjCount,
        ticketMedio: pjCount ? pjTotal / pjCount : 0
      });
    }
    if (pfTotal > 0 || pfCount > 0) {
      data.push({
        name: "Pessoa Física (Individual/Familiar)",
        value: pfTotal,
        count: pfCount,
        ticketMedio: pfCount ? pfTotal / pfCount : 0
      });
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
    return [...notasFiltradas].sort((a, b) => (getDateField(b) || "").localeCompare(getDateField(a) || ""));
  }, [notasFiltradas, getDateField]);

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
      addActivity("upload", `${allNotas.length} Notas Importadas`, `Importação de XMLs finalizada com sucesso.`);
      setRightPanelOpen(true);
    }
    setProgress(null);
    setImporting(false);
    toast.success(
      `${allNotas.length} nota(s) importada(s). ${skipped ? skipped + " ignorada(s)." : ""}`,
    );
  }, [addActivity]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const clearDb = async () => {
    if (confirm("Apagar TODA a base de dados local? Esta ação não pode ser desfeita.")) {
      await db.notas.clear();
      addActivity("clear", "Base de Dados Limpa", "Todas as notas foram excluídas do banco local.");
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
      addActivity("conciliation", "Planilha Carregada", `Relatório "${file.name}" carregado com ${rows.length} linhas.`);
      setRightPanelOpen(true);
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
      addActivity("update", "Divergências Aplicadas", `${changes.length} nota(s) retificada(s) no banco local.`);
      setRightPanelOpen(true);
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
    <div className="min-h-screen bg-slate-50/50 flex font-sans antialiased text-slate-800 w-full overflow-hidden">
      <Toaster richColors position="top-right" />

      {/* LEFT SIDEBAR (ByeWind / SnowUI style) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-100 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-64 flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900 leading-none">Smart Fiscal</h2>
              <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Diretoria BI</span>
            </div>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100/50 mt-2">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              DS
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">Diretoria Samel</p>
              <p className="text-[10px] text-slate-400 truncate">diretoria@samel.com.br</p>
            </div>
          </div>

          {/* Regime de Data (Competência vs Emissão) */}
          <div className="flex flex-col gap-2 px-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Regime de Data</span>
            <div className="grid grid-cols-2 bg-slate-50 p-1 rounded-xl border border-slate-100/50">
              <button
                onClick={() => {
                  setPeriodType("competencia");
                  addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                  toast.info("Regime de Data: Competência");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                  periodType === "competencia"
                    ? "bg-white text-slate-950 shadow-xs font-semibold"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Competência
              </button>
              <button
                onClick={() => {
                  setPeriodType("emissao");
                  addActivity("update", "Regime Alterado: Emissão", "Cálculos parametrizados pela data de Emissão.");
                  toast.info("Regime de Data: Emissão");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                  periodType === "emissao"
                    ? "bg-white text-slate-950 shadow-xs font-semibold"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Emissão
              </button>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-5 mt-4">
            {/* Favorites Category */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Favoritos</span>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all relative w-full text-left ${
                  activeTab === "dashboard"
                    ? "bg-slate-50 text-slate-950 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                {activeTab === "dashboard" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-slate-950" />
                )}
                <LayoutDashboard className="h-4 w-4" /> Visão Geral Faturamento
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all relative w-full text-left ${
                  activeTab === "conciliation"
                    ? "bg-slate-50 text-slate-950 font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                }`}
              >
                {activeTab === "conciliation" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-slate-950" />
                )}
                <FileSpreadsheet className="h-4 w-4" /> Validador Sintético
              </button>
            </div>

            {/* Dashboards Category */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Dashboards</span>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "dashboard" ? "text-slate-950 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4" /> Faturamento
                </div>
                {notasAtivas.length > 0 && (
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono">
                    {notasAtivas.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "conciliation" ? "text-slate-950 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4" /> Conciliador
                </div>
                {conciliatedStats.updated > 0 && (
                  <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-md font-mono">
                    {conciliatedStats.updated}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions Category */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Ações Rápidas</span>
              <button
                onClick={exportCsv}
                disabled={!notasFiltradas.length}
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50/50 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-transparent w-full text-left"
              >
                <Download className="h-4 w-4" /> Exportar Relatório CSV
              </button>
              <button
                onClick={clearDb}
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 rounded-xl transition-all w-full text-left"
              >
                <Trash2 className="h-4 w-4" /> Limpar Base Local
              </button>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span>v1.01 SPED</span>
          <span className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full text-slate-500">100% Local</span>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEBAR */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs md:hidden"
        />
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* HEADER BAR (ByeWind Style) */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0">
          {/* Header Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button className="text-slate-300 hover:text-amber-400 transition-colors hidden sm:block">
              <Star className="h-4 w-4 fill-current text-slate-200" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <span>Dashboards</span>
              <span>/</span>
              <span className="text-slate-800 font-semibold">
                {activeTab === "dashboard" ? "Faturamento Geral" : "Validador Planilhas"}
              </span>
            </div>
          </div>

          {/* Header Right */}
          <div className="flex items-center gap-3">
            {/* Search Input Placeholder */}
            <div className="relative w-48 lg:w-64 hidden sm:block">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="w-full h-8 pl-8 pr-10 rounded-lg bg-slate-50 border border-slate-100 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-200 transition-all placeholder:text-slate-400"
              />
              <span className="absolute right-2.5 top-2 text-[9px] font-mono text-slate-400 bg-slate-200/60 px-1 rounded-md">
                ⌘/
              </span>
            </div>

            {/* Utility Icons */}
            <button
              onClick={() => addActivity("update", "Preferências Atualizadas", "O usuário atualizou as preferências do sistema.")}
              className="h-8 w-8 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Clock className="h-4 w-4" />
            </button>

            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-8 w-8 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              {activities.length > 1 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
              )}
            </button>

            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-8 w-8 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors hidden md:flex"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
          
          {/* MOBILE TABS CONTROLLER (Fallback Tab List for small screens) */}
          <div className="flex justify-between items-center gap-4 flex-wrap md:hidden bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visualização</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "dashboard" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                BI & Dashboards
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "conciliation" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Validador (.xlsx)
              </button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
            <TabsContent value="dashboard" className="space-y-6 mt-0 outline-none">
              
              {/* PAGE MAIN HEADER / FILTERS PANEL */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">Consulta de Faturamento</h1>
                  <p className="text-xs text-slate-400 mt-1">Análise consolidada para a diretoria · Samel</p>
                </div>
                
                {/* Responsive Filter Grid */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Regime Toggle Pills */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40 mr-1">
                    <button
                      onClick={() => {
                        setPeriodType("competencia");
                        addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                        toast.info("Regime de Data: Competência");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodType === "competencia"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Competência
                    </button>
                    <button
                      onClick={() => {
                        setPeriodType("emissao");
                        addActivity("update", "Regime Alterado: Emissão", "Cálculos parametrizados pela data de Emissão.");
                        toast.info("Regime de Data: Emissão");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodType === "emissao"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Emissão
                    </button>
                  </div>

                  <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                    <SelectTrigger className="w-[220px] h-9 text-xs rounded-xl bg-slate-50 border-slate-100 hover:bg-slate-100/50 transition-colors">
                      <Building2 className="h-3.5 w-3.5 mr-2 text-slate-400 flex-shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-slate-100">
                      <SelectItem value="__all__">Todas as Empresas</SelectItem>
                      {empresas.map((e) => (
                        <SelectItem key={e.cnpj} value={e.cnpj}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={mesFiltro} onValueChange={setMesFiltro}>
                    <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-slate-50 border-slate-100 hover:bg-slate-100/50 transition-colors">
                      <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400 flex-shrink-0" />
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-slate-100">
                      <SelectItem value="__all__">Todos os meses</SelectItem>
                      {mesesOpcoes.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                    <SelectTrigger className="w-[105px] h-9 text-xs rounded-xl bg-slate-50 border-slate-100 hover:bg-slate-100/50 transition-colors">
                      <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400 flex-shrink-0" />
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-slate-100">
                      <SelectItem value="__all__">Todos os anos</SelectItem>
                      {anos.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={cServFiltro} onValueChange={setCServFiltro}>
                    <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl bg-slate-50 border-slate-100 hover:bg-slate-100/50 transition-colors">
                      <Tag className="h-3.5 w-3.5 mr-2 text-slate-400 flex-shrink-0" />
                      <SelectValue placeholder="Serviço" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-slate-100">
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
                onClick={() => fileRef.current?.click()}
                className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-50/50 scale-[1.005]"
                    : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/30"
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
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      <p className="font-semibold text-xs text-slate-700">Processando XMLs NFS-e...</p>
                      {progress && (
                        <p className="text-[10px] text-slate-400">
                          {progress.done} / {progress.total} XMLs
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-indigo-600" />
                      </div>
                      <p className="font-semibold text-xs text-slate-700">
                        Arraste os arquivos .zip de XMLs aqui ou clique para selecionar
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Suporta múltiplos arquivos ZIP contendo XMLs no padrão NFS-e Nacional (SPED v1.01)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* METRICS / KPI GRID (ByeWind style: clean card layout, light pastel colors, trend arrows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                <KpiCardNew
                  label="Faturamento Válido"
                  value={fmtBRL(faturamento)}
                  trendText={faturamentoTrend.text}
                  isPositive={faturamentoTrend.isPositive}
                  subtext="comparado ao período anterior"
                  tone="blue"
                />
                <KpiCardNew
                  label="Faturamento Plano de Saúde"
                  value={fmtBRL(plansFaturamento)}
                  trendText={plansTrend.text}
                  isPositive={plansTrend.isPositive}
                  subtext="código 042201"
                  tone="purple"
                />
                <KpiCardNew
                  label="Faturamento Serviços Hospitalares"
                  value={fmtBRL(hospFaturamento)}
                  trendText={hospTrend.text}
                  isPositive={hospTrend.isPositive}
                  subtext="códigos 040301, 043301"
                  tone="green"
                />
                <KpiCardNew
                  label="Notas Emitidas Válidas"
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
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detalhamento de Impostos & Tributos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* ISS Retido */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100/50 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ISS Retido</p>
                      <p className="text-lg font-bold text-slate-900 mt-1.5">{fmtBRL(issRetidoTotal)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Retido na fonte pelo tomador</p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  
                  {/* ISS a Recolher */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100/50 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ISS a Recolher</p>
                      <p className="text-lg font-bold text-slate-900 mt-1.5">{fmtBRL(issARecolherTotal)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Recolhimento próprio do prestador</p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Receipt className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  {/* Demais Tributos Federais */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100/50 flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tributos Federais</p>
                      <p className="text-lg font-bold text-slate-900 mt-1.5">{fmtBRL(tributosFederaisTotal)}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2 pt-1 border-t border-slate-200/50 text-[9px] text-slate-400 font-mono">
                        <div>PIS: <span className="text-slate-700 font-semibold">{fmtBRL(pisTotal)}</span></div>
                        <div>COFINS: <span className="text-slate-700 font-semibold">{fmtBRL(cofinsTotal)}</span></div>
                        <div>CSLL: <span className="text-slate-700 font-semibold">{fmtBRL(csllTotal)}</span></div>
                        <div>IRRF: <span className="text-slate-700 font-semibold">{fmtBRL(irrfTotal)}</span></div>
                        <div className="col-span-2">INSS: <span className="text-slate-700 font-semibold">{fmtBRL(inssTotal)}</span></div>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4.5 w-4.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* PRIMARY CHARTS & DETAILS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Faturamento Line Chart (ByeWind Image 1 line chart layout) */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-8">
                  <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Evolução do Faturamento</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Comparativo do faturamento com o período imediatamente anterior</p>
                    </div>
                    {/* Legend keys matching image 1 & 2 */}
                    <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                        <span>Período Atual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <span className="border-b border-dashed border-slate-500 pb-0.5">Período Anterior</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-[280px]">
                    {lineChartData.length === 0 ? (
                      <EmptyState />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
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
                                  `Dashboard filtrado para o mês de ${state.activeLabel} via clique no gráfico.`
                                );
                                toast.success(`Filtrado pelo mês: ${state.activeLabel}`);
                              }
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) =>
                              v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                            }
                          />
                          <Tooltip
                            formatter={(v) => fmtBRL(Number(v))}
                            contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}
                          />
                          <Bar
                            dataKey="Período Anterior"
                            fill="#cbd5e1"
                            opacity={0.6}
                            radius={[4, 4, 0, 0]}
                            barSize={12}
                            style={{ cursor: "pointer" }}
                          />
                          <Bar
                            dataKey="Período Atual"
                            fill="#6366f1"
                            radius={[4, 4, 0, 0]}
                            barSize={12}
                            style={{ cursor: "pointer" }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Top Services (ByeWind "Traffic by Website" progress layout) */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 mb-1">Faturamento por Serviço</h3>
                    <p className="text-[10px] text-slate-400 mb-4">Participação dos principais serviços prestados</p>
                    
                    <div className="space-y-4">
                      {topServicesList.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-12">Nenhum serviço registrado</div>
                      ) : (
                        topServicesList.map((service, index) => (
                          <div key={index} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={service.name}>
                                {service.name}
                              </span>
                              <span className="font-medium text-slate-500 font-mono text-[10px]">
                                {service.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Custom styled progress bars following image 1 */}
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${service.percentage}%`,
                                    backgroundColor: COLORS[index % COLORS.length]
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap w-16 text-right">
                                {service.value >= 1000 ? `R$ ${(service.value / 1000).toFixed(0)}k` : `R$ ${service.value}`}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>Base local Samel</span>
                    <span>Multiempresa</span>
                  </div>
                </div>
              </div>

              {/* SECONDARY CHARTS GRID (Donut Charts & Top Clients Table) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Donut Chart: Faturamento PJ vs PF */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-1">Perfil do Cliente</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Faturamento distribuído entre PJ e PF</p>
                  
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
                            >
                              <Cell fill="#6366f1" />
                              <Cell fill="#ec4899" />
                            </Pie>
                            <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend aligned on the side/bottom */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                          <span className="text-sm font-extrabold text-slate-800">
                            {faturamento >= 1000000 ? `R$ ${(faturamento / 1000000).toFixed(1)}M` : `R$ ${(faturamento / 1000).toFixed(0)}k`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-slate-50 text-xs">
                    {pjPfData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: idx === 0 ? "#6366f1" : "#ec4899" }} />
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-bold text-slate-800">{fmtBRL(item.value)}</span>
                          <span className="text-[9px] text-slate-400 font-mono">T. Médio: {fmtBRL(item.ticketMedio)} ({item.count} notas)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Chart: Planos vs Hospitais Comparativo */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-1">Comparativo de Serviços Chave</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Planos de Saúde vs. Serviços Hospitalares</p>
                  
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
                            >
                              {comparativoServicosData
                                .filter((d) => d.value > 0)
                                .map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Foco BI</span>
                          <span className="text-xs font-bold text-slate-800">Samel</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-around items-center mt-3 pt-3 border-t border-slate-50 text-xs">
                    {comparativoServicosData.filter(d => d.value > 0).map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="truncate max-w-[100px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-800 mt-0.5">{fmtBRL(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Clients Table (ByeWind "Top Selling Products" style from Image 2) */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-1">
                  <h3 className="text-xs font-bold text-slate-800 mb-1">Principais Clientes</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Top 5 tomadores por volume de faturamento</p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                          <th className="pb-2 font-medium">Nome / CNPJ</th>
                          <th className="pb-2 text-center font-medium">Notas</th>
                          <th className="pb-2 text-right font-medium">Faturamento</th>
                          <th className="pb-2 text-right font-medium">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topClientesList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-slate-400 py-12">Nenhum cliente registrado</td>
                          </tr>
                        ) : (
                          topClientesList.map((client, index) => {
                            const share = faturamento > 0 ? (client.total / faturamento) * 100 : 0;
                            const isHighConcentration = share > 10;
                            return (
                              <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="py-2.5 max-w-[120px]">
                                  <div className="font-semibold text-slate-700 truncate" title={client.nome}>
                                    {client.nome}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {formatarCnpjCpf(client.cnpjCpf)}
                                  </div>
                                </td>
                                <td className="py-2.5 text-center text-slate-600 font-mono text-[10px]">{client.count}</td>
                                <td className="py-2.5 text-right font-bold text-slate-800">{fmtBRL(client.total)}</td>
                                <td className="py-2.5 text-right font-medium">
                                  <div className={`flex items-center justify-end gap-1 font-mono text-[10px] ${
                                    isHighConcentration ? "text-rose-600 font-bold" : "text-slate-500"
                                  }`}>
                                    {isHighConcentration && <AlertTriangle className="h-3 w-3 text-rose-500 animate-pulse" />}
                                    {share.toFixed(1)}%
                                  </div>
                                  {isHighConcentration && (
                                    <span className="text-[7px] text-rose-500 font-bold uppercase tracking-wider block">
                                      Alta Conc.
                                    </span>
                                  )}
                                </td>
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
              <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    Notas Fiscais Emitidas ({notasFiltradas.length.toLocaleString("pt-BR")})
                  </h3>
                  
                  {/* Search and Period Filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Buscar por cliente..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        className="pl-8 h-8 rounded-lg text-xs bg-slate-50 border-slate-100 hover:bg-slate-100/30 focus:bg-white placeholder:text-slate-400 w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[1400px]">
                    <TableHeader className="bg-slate-50/70">
                      <TableRow className="border-b border-slate-100">
                        <TableHead className="font-medium text-slate-400 h-9">Nº NFS</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">Emissão</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">Competência</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">CNPJ/CPF Cliente</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">Cliente</TableHead>
                        <TableHead className="text-right font-medium text-slate-400 h-9">Vlr. Serviço</TableHead>
                        <TableHead className="text-right font-medium text-slate-400 h-9">Vlr. Líquido</TableHead>
                        <TableHead className="text-right font-medium text-slate-400 h-9">Vlr. ISS</TableHead>
                        <TableHead className="text-center font-medium text-slate-400 h-9">ISS Retido?</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">Serviço</TableHead>
                        <TableHead className="font-medium text-slate-400 h-9">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedNotas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-slate-400 py-12 text-xs">
                            Nenhuma nota fiscal encontrada no banco local. Envie um ZIP com XMLs para começar.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedNotas.map((n) => (
                          <TableRow key={n.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-mono text-[10px] text-slate-600 font-semibold">{n.nNFSe}</TableCell>
                            <TableCell className="text-xs text-slate-600 whitespace-nowrap">{formatarData(n.dhEmi)}</TableCell>
                            <TableCell className="text-xs text-slate-500 whitespace-nowrap">{formatarCompetencia(n.dCompet)}</TableCell>
                            <TableCell className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{formatarCnpjCpf(n.cnpjCpfCliente)}</TableCell>
                            <TableCell className="text-xs text-slate-700 max-w-[180px] truncate font-medium" title={n.cliente}>{n.cliente}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-slate-800">{fmtBRL(n.valor)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-slate-600">{fmtBRL(n.vlrLiquido ?? n.valor)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-slate-500">{fmtBRL(n.vlrIss ?? 0)}</TableCell>
                            <TableCell className="text-center">
                              {n.issRetido === "Sim" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                  Sim
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
                                  Não
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}>
                              {n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}
                            </TableCell>
                            <TableCell>
                              {n.status === "ativa" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  Ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                  Cancelada
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-500">
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
            </TabsContent>

            <TabsContent value="conciliation" className="space-y-6 mt-0 outline-none">
              
              {/* XLSX DROP ZONE */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setXlsxDragOver(true);
                }}
                onDragLeave={() => setXlsxDragOver(false)}
                onDrop={onXlsxDrop}
                onClick={() => xlsxRef.current?.click()}
                className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
                  xlsxDragOver
                    ? "border-indigo-500 bg-indigo-50/50 scale-[1.005]"
                    : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/30"
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
                      <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                      <p className="font-semibold text-xs text-slate-700">Conciliando Planilha de Faturamento...</p>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                      </div>
                      {xlsxFile ? (
                        <>
                          <p className="font-semibold text-xs text-indigo-600">{xlsxFile.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Clique ou arraste outro arquivo para substituir
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-xs text-slate-700">
                            Arraste a planilha de fechamento fiscal (.xlsx) aqui ou clique para selecionar
                          </p>
                          <p className="text-[10px] text-slate-400">
                            O arquivo deve conter as colunas de "Chave de Acesso" e "Situação/Status"
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* CONCILIATION RESULT VIEW */}
              {xlsxRows.length > 0 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Columns Mappings Panel */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs lg:col-span-4 flex flex-col gap-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">Mapeamento de Planilha</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Identifique as colunas de referência do seu relatório Excel</p>
                      </div>

                      <div className="space-y-3 mt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coluna Chave de Acesso</label>
                          <Select value={keyCol} onValueChange={(val) => setKeyCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-slate-100 bg-slate-50">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-slate-100">
                              {xlsxHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coluna Status / Situação</label>
                          <Select value={statusCol} onValueChange={(val) => setStatusCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-slate-100 bg-slate-50">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-slate-100">
                              {xlsxHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coluna Operação (ISS Retido)</label>
                          <Select value={operacaoCol} onValueChange={(val) => setOperacaoCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-slate-100 bg-slate-50">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-slate-100">
                              {xlsxHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Stats Dashboard Grid */}
                    <div className="lg:col-span-8 grid grid-cols-2 gap-4">
                      
                      {/* Divergent Notes Card */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center justify-between bg-white">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Divergentes / Retificáveis</p>
                          <p className="text-2xl font-extrabold text-indigo-600 mt-1">{conciliatedStats.updated}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Diferem das notas no banco local</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <AlertTriangle className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Correct / Conciliated Card */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center justify-between bg-white">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Já Conciliadas</p>
                          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{conciliatedStats.alreadyCorrect}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Alinhadas com banco local</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <Check className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Missing Card */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center justify-between bg-white">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Não Encontradas</p>
                          <p className="text-2xl font-extrabold text-rose-500 mt-1">{conciliatedStats.notFound}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Inexistentes no banco de dados</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                          <XCircle className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Total Processed Card */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex items-center justify-between bg-white">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Processado</p>
                          <p className="text-2xl font-extrabold text-slate-700 mt-1">{conciliatedStats.total}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">Linhas identificadas na planilha</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                          <FileSpreadsheet className="h-4.5 w-4.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RESULTS TABLE */}
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">Resultados da Validação Sintética</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Auditoria linha a linha entre planilha (.xlsx) e XMLs locais</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={applyUpdates}
                          disabled={conciliatedStats.updated === 0}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs h-8"
                        >
                          <Check className="h-3.5 w-3.5 mr-1.5" /> Retificar Status no Banco
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportValidationCsv}
                          disabled={conciliatedItems.length === 0}
                          className="border-slate-200 hover:bg-slate-50 text-slate-600 text-xs h-8"
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar Relatório de Divergências
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/70">
                          <TableRow className="border-b border-slate-100">
                            <TableHead className="font-medium text-slate-400 h-9">Linha</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">Chave de Acesso</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">Nº NFS-e</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">Prestador</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">Status (Planilha | Local)</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">ISS Retido (Planilha | Local)</TableHead>
                            <TableHead className="font-medium text-slate-400 h-9">Auditoria</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conciliatedItems.map((item, idx) => (
                            <TableRow
                              key={idx}
                              className={`border-b border-slate-50 hover:bg-slate-50/30 transition-colors ${
                                item.statusChanged || item.issRetidoDivergent ? "bg-amber-50/20 hover:bg-amber-50/40" : ""
                              }`}
                            >
                              <TableCell className="font-mono text-[10px] text-slate-400">{item.rowNumber}</TableCell>
                              <TableCell className="font-mono text-[10px] text-slate-500 max-w-[220px] truncate" title={item.rawKey}>
                                {item.rawKey}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-slate-600 font-semibold">{item.nNFSe}</TableCell>
                              <TableCell className="text-xs text-slate-600 max-w-[150px] truncate" title={item.prestador}>
                                {item.prestador}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.statusExcel === "ativa" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                    {item.statusExcel === "ativa" ? "Ativa" : "Canc."}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-slate-400 text-[9px] font-medium">Inexistente</span>
                                  ) : (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.statusLocal === "ativa" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                      {item.statusLocal === "ativa" ? "Ativa" : "Canc."}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  {item.issRetidoExcel ? (
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${item.issRetidoExcel === "Sim" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                                      {item.issRetidoExcel}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                  <span className="text-slate-300">|</span>
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-slate-400 text-[9px] font-medium">Inexistente</span>
                                  ) : item.issRetidoLocal ? (
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${item.issRetidoLocal === "Sim" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                                      {item.issRetidoLocal}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-semibold">
                                {item.statusLocal === "nao_encontrado" ? (
                                  <span className="text-rose-500 text-[10px] font-semibold flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Inexistente no Banco
                                  </span>
                                ) : item.statusChanged || item.issRetidoDivergent ? (
                                  <span className="text-amber-600 text-[10px] font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {item.statusChanged && item.issRetidoDivergent
                                      ? "Status e ISS divergentes"
                                      : item.statusChanged
                                        ? "Status divergente"
                                        : "ISS Retido divergente"}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 text-[10px] font-semibold flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> Conciliado
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <footer className="text-center text-[10px] text-slate-400 pt-8 mt-12 border-t border-slate-100">
            🔒 Processamento 100% Client-Side local — Seus XMLs NFS-e e planilhas financeiras nunca saem do seu navegador.
          </footer>
        </main>
      </div>

      {/* RIGHT PANEL: ALERTS & ACTIVITIES (ByeWind style: clean drawer sliding from right) */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 bg-white border-l border-slate-100 w-80 flex flex-col justify-between transition-transform duration-300 ease-in-out transform shadow-xl md:shadow-none flex-shrink-0 ${
          rightPanelOpen ? "translate-x-0 animate-in slide-in-from-right duration-300" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Alertas & Atividades</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Linha do tempo de auditorias e importações</p>
            </div>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="h-6 w-6 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico Recente</h4>
            
            <div className="relative pl-4 border-l border-slate-100 flex flex-col gap-5">
              {activities.map((act) => {
                const colors = {
                  upload: "bg-blue-500",
                  conciliation: "bg-purple-500",
                  clear: "bg-rose-500",
                  update: "bg-emerald-500",
                };
                return (
                  <div key={act.id} className="relative group">
                    {/* Timeline node */}
                    <span className={`absolute -left-[20px] top-1.5 h-2 w-2 rounded-full ring-4 ring-white ${colors[act.type] || "bg-slate-400"}`} />
                    
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-800 leading-tight">{act.title}</span>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{act.description}</p>
                      <span className="text-[9px] text-slate-400 font-mono mt-1">
                        {act.time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Team Contacts (ByeWind style: Contacts section at the bottom) */}
          <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-slate-50">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Equipe Financeira</h4>
            
            <div className="flex flex-col gap-3">
              <ContactItem name="Natali Craig" role="Contadora Líder Samel" avatarText="NC" />
              <ContactItem name="Drew Cano" role="Diretor Financeiro" avatarText="DC" />
              <ContactItem name="Orlando Diggs" role="Analista Fiscal" avatarText="OD" />
              <ContactItem name="Andi Lane" role="Auditor Externo" avatarText="AL" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium bg-slate-50/50">
          Auditoria de Fechamento Executivo
        </div>
      </aside>
    </div>
  );
}

// Sub-components helper for Contacts
function ContactItem({ name, role, avatarText }: { name: string; role: string; avatarText: string }) {
  return (
    <div className="flex items-center gap-2.5 p-1 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
      <div className="h-7 w-7 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
        {avatarText}
      </div>
      <div className="overflow-hidden">
        <p className="text-[11px] font-bold text-slate-700 leading-tight truncate">{name}</p>
        <p className="text-[9px] text-slate-400 truncate mt-0.5">{role}</p>
      </div>
    </div>
  );
}

// Redesigned KpiCard for ByeWind theme
function KpiCardNew({
  label,
  value,
  trendText,
  isPositive,
  subtext,
  tone,
}: {
  label: string;
  value: string;
  trendText: string;
  isPositive: boolean;
  subtext: string;
  tone: "blue" | "purple" | "green" | "rose" | "amber";
}) {
  const bgColors = {
    blue: "bg-blue-50/70 border-blue-100/70 text-blue-800",
    purple: "bg-purple-50/70 border-purple-100/70 text-purple-800",
    green: "bg-emerald-50/70 border-emerald-100/70 text-emerald-800",
    rose: "bg-rose-50/70 border-rose-100/70 text-rose-800",
    amber: "bg-amber-50/70 border-amber-100/70 text-amber-800",
  };

  return (
    <div className={`p-5 rounded-2xl border ${bgColors[tone]} flex flex-col justify-between shadow-xs hover:shadow-sm transition-all duration-200 bg-white`}>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100/30">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
            isPositive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {trendText} {isPositive ? "↗" : "↘"}
        </span>
        <span className="text-[9px] text-slate-400 font-medium truncate">{subtext}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      Sem dados para os filtros atuais.
    </div>
  );
}
