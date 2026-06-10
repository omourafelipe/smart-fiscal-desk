import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import JSZip from "jszip";
import { useLiveQuery } from "dexie-react-hooks";
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
  ShoppingBag,
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
  Sun,
  Moon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { db, type NotaFiscal, type NotaFiscalTomada } from "@/lib/db";
import { parseNfseXml, parseNfseXmlTomada } from "@/lib/parseXml";
import {
  parseExcelFile,
  detectColumns,
  parseExcelStatus,
  normalizeString,
  parseExcelIssRetido,
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
  statusExcel: "válida" | "cancelada";
  statusLocal: "válida" | "cancelada" | "nao_encontrado";
  statusChanged: boolean;
  notaId?: string;
  rawIssRetido?: string;
  issRetidoExcel?: "Sim" | "Não";
  issRetidoLocal?: "Sim" | "Não" | "—";
  issRetidoChanged?: boolean;
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

/**
 * Classifica uma descrição de serviço (xDescServ) em uma categoria geral.
 * Match case-insensitive; primeira regra a casar vence.
 */
function categorizarServico(desc: string): string {
  const s = (desc || "").toLowerCase();
  if (!s.trim()) return "Outros";
  const rules: Array<[string, string[]]> = [
    ["Saúde / Hospitalar", ["hospital", "médic", "medic", "clínic", "clinic", "laboratóri", "laboratori", "exame", "enfermag", "fisioterap", "saúde", "saude"]],
    ["Locação / Aluguel", ["locaç", "locac", "aluguel"]],
    ["Manutenção e Reparos", ["manutenç", "manutenc", "reparo", "conserto", "assistência técnica", "assistencia tecnica"]],
    ["Limpeza e Conservação", ["limpeza", "conservaç", "conservac", "higieniz"]],
    ["Segurança e Vigilância", ["seguranç", "seguranc", "vigilânc", "vigilanc", "portaria"]],
    ["Transporte e Logística", ["transporte", "frete", "logístic", "logistic", "entrega"]],
    ["Consultoria e Assessoria", ["consultor", "assessor", "advoc", "jurídic", "juridic", "contábil", "contabil", "auditoria"]],
    ["Tecnologia / TI", ["software", "sistema", "informátic", "informatic", "licença", "licenca", "hospedagem", "cloud", "suporte técnic", "suporte tecnic"]],
    ["Treinamento e Educação", ["treinamento", "curso", "capacitaç", "capacitac", "ensino", "educação", "educacao"]],
    ["Publicidade e Marketing", ["publicidade", "marketing", "propaganda", "mídia", "midia"]],
    ["Engenharia e Construção", ["engenhar", "obra", "construç", "construc", "projeto"]],
    ["Alimentação", ["alimentaç", "alimentac", "refeiç", "refeic", "restaurante", "lanche"]],
  ];
  for (const [cat, keys] of rules) {
    if (keys.some((k) => s.includes(k))) return cat;
  }
  return "Outros";
}

function Dashboard() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") as "light" | "dark" | null;
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const initialTheme = saved || systemPreference;
      setTheme(initialTheme);
      
      const root = window.document.documentElement;
      if (initialTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    const root = window.document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", nextTheme);
  };

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Layout & Navigation States
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarOpen");
      return saved === "true"; // default to false
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarOpen", String(next));
      return next;
    });
  };

  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "conciliation" | "grupo" | "tomados">("dashboard");

  // ── Serviços Tomados state ──────────────────────────────────────────────
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], [] as NotaFiscalTomada[]);
  const [importingTomadas, setImportingTomadas] = useState(false);
  const [progressTomadas, setProgressTomadas] = useState<{ done: number; total: number } | null>(null);
  const [dragOverTomadas, setDragOverTomadas] = useState(false);
  const [mesFiltroTomadas, setMesFiltroTomadas] = useState("__all__");
  const [anoFiltroTomadas, setAnoFiltroTomadas] = useState("__all__");
  const [empresaFiltroTomadas, setEmpresaFiltroTomadas] = useState("__all__");
  const [pageTomadas, setPageTomadas] = useState(1);
  const fileRefTomadas = useRef<HTMLInputElement>(null);
  const PAGE_SIZE_TOMADAS = 20;

  const processFilesTomadas = useCallback(async (files: FileList) => {
    setImportingTomadas(true);
    setProgressTomadas(null);
    // Build set of group CNPJs from existing notas
    const existingNotas = await db.notas.toArray();
    const cnpjsGrupo = new Set(
      existingNotas.map((n) => n.cnpjPrestador.replace(/\D/g, "")).filter(Boolean)
    );
    const zipFiles = Array.from(files).filter((f) => f.name.endsWith(".zip"));
    let totalXmls = 0;
    let doneXmls = 0;
    const batch: NotaFiscalTomada[] = [];
    for (const zipFile of zipFiles) {
      const buf = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const xmlEntries = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".xml"));
      totalXmls += xmlEntries.length;
      for (const entry of xmlEntries) {
        const xml = await entry.async("string");
        const nota = parseNfseXmlTomada(xml, cnpjsGrupo);
        if (nota) batch.push(nota);
        doneXmls++;
        setProgressTomadas({ done: doneXmls, total: totalXmls });
      }
    }
    if (batch.length > 0) {
      await db.notasTomadas.bulkPut(batch);
      toast.success(`${batch.length} nota(s) de serviço tomado importada(s).`);
    } else {
      toast.warning("Nenhuma nota com CNPJ do grupo como tomador foi encontrada.");
    }
    setImportingTomadas(false);
    setProgressTomadas(null);
  }, []);

  const onDropTomadas = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTomadas(false);
    if (e.dataTransfer.files?.length) processFilesTomadas(e.dataTransfer.files);
  };

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
  const [issCol, setIssCol] = useState<string>("");
  const [conciliatedItems, setConciliatedItems] = useState<ConciliationResult[]>([]);
  const [isXlsxProcessing, setIsXlsxProcessing] = useState(false);
  const [conciliatedStats, setConciliatedStats] = useState({
    total: 0,
    updated: 0,
    alreadyCorrect: 0,
    notFound: 0,
  });

  const [empresaFiltro, setEmpresaFiltro] = useState<string>("__all__");
  const [mesFiltro, setMesFiltro] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return String(d.getMonth() + 1).padStart(2, "0");
  });
  const [anoFiltro, setAnoFiltro] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return String(d.getFullYear());
  });
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

  // Mapa fast das chaves da planilha e seu status correspondente
  const xlsxStatusMap = useMemo(() => {
    const map = new Map<string, "válida" | "cancelada" | "nao_encontrado">();
    if (xlsxRows.length > 0 && keyCol && statusCol) {
      xlsxRows.forEach((row) => {
        const rawKey = String(row[keyCol] ?? "").trim();
        const key = rawKey.replace(/\D/g, "");
        if (key) {
          const rawStatus = String(row[statusCol] ?? "").trim();
          map.set(key, parseExcelStatus(rawStatus));
        }
      });
    }
    return map;
  }, [xlsxRows, keyCol, statusCol]);

  // Função para determinar o status com base puramente na planilha se ela estiver carregada
  const getNoteStatus = useCallback((n: NotaFiscal) => {
    if (xlsxRows.length > 0 && n.chave && xlsxStatusMap.has(n.chave)) {
      return xlsxStatusMap.get(n.chave) || "válida";
    }
    return n.status || "válida";
  }, [xlsxStatusMap, xlsxRows]);

  const notasAtivasGrupo = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      const dateStr = getDateField(n);
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
      return true;
    });
  }, [todasNotas, mesFiltro, anoFiltro, cServFiltro, getDateField, getNoteStatus]);

  const groupStats = useMemo(() => {
    const companyMap = new Map<string, { cnpj: string; nome: string; total: number; count: number; intergrupo: number; externo: number }>();
    
    empresas.forEach((e) => {
      companyMap.set(e.cnpj.replace(/\D/g, ""), {
        cnpj: e.cnpj,
        nome: e.nome,
        total: 0,
        count: 0,
        intergrupo: 0,
        externo: 0,
      });
    });

    let totalGroupBilling = 0;
    let totalIntergrupoBilling = 0;
    const intergroupNotes: Array<NotaFiscal & { tomadorNome: string }> = [];

    notasAtivasGrupo.forEach((n) => {
      const prestadorCnpjClean = n.cnpjPrestador.replace(/\D/g, "");
      
      let entry = companyMap.get(prestadorCnpjClean);
      if (!entry) {
        entry = {
          cnpj: n.cnpjPrestador,
          nome: n.nomePrestador || n.cnpjPrestador,
          total: 0,
          count: 0,
          intergrupo: 0,
          externo: 0,
        };
        companyMap.set(prestadorCnpjClean, entry);
      }
      
      entry.total += n.valor;
      entry.count++;
      totalGroupBilling += n.valor;

      const tomadorNome = checkIntergrupo(n.cnpjCpfCliente);
      if (tomadorNome) {
        entry.intergrupo += n.valor;
        totalIntergrupoBilling += n.valor;
        intergroupNotes.push({
          ...n,
          tomadorNome
        });
      } else {
        entry.externo += n.valor;
      }
    });

    const companyList = Array.from(companyMap.values()).map((c) => {
      return {
        ...c,
        externo: c.total - c.intergrupo,
        share: totalGroupBilling > 0 ? (c.total / totalGroupBilling) * 100 : 0
      };
    }).sort((a, b) => b.total - a.total);

    const totalExternalBilling = totalGroupBilling - totalIntergrupoBilling;

    return {
      companyList,
      totalGroupBilling,
      totalIntergrupoBilling,
      totalExternalBilling,
      intergroupNotes: intergroupNotes.sort((a, b) => (getDateField(b) || "").localeCompare(getDateField(a) || "")),
    };
  }, [notasAtivasGrupo, empresas, checkIntergrupo, getDateField]);

  const groupLineChartData = useMemo(() => {
    if (!todasNotas) return [];
    
    const currentGroupNotas = todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
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
      return true;
    });

    const brutoMap = new Map<string, number>();
    const intergrupoMap = new Map<string, number>();

    currentGroupNotas.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const key = dateStr.slice(5, 7); // MM
      
      brutoMap.set(key, (brutoMap.get(key) ?? 0) + n.valor);
      
      if (checkIntergrupo(n.cnpjCpfCliente)) {
        intergrupoMap.set(key, (intergrupoMap.get(key) ?? 0) + n.valor);
      }
    });

    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = [];
    
    for (let i = 1; i <= 12; i++) {
      const mesStr = String(i).padStart(2, "0");
      const bruto = brutoMap.get(mesStr) ?? 0;
      const intergrupo = intergrupoMap.get(mesStr) ?? 0;
      const liquido = bruto - intergrupo;
      
      data.push({
        label: mesesAbrev[i - 1],
        "Faturamento Bruto": bruto,
        "Faturamento Intergrupo": intergrupo,
        "Faturamento Líquido": liquido,
      });
    }
    return data;
  }, [todasNotas, anoFiltro, cServFiltro, checkIntergrupo, getDateField, getNoteStatus]);


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
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, getDateField]);

  const notasAtivas = notasFiltradas.filter((n) => getNoteStatus(n) === "válida");
  const notasCanceladas = notasFiltradas.filter((n) => getNoteStatus(n) === "cancelada");
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
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField]);

  const prevNotasAtivas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => getNoteStatus(n) === "válida");
  }, [prevNotasFiltradas, getNoteStatus]);

  const prevNotasCanceladas = useMemo(() => {
    return prevNotasFiltradas.filter((n) => getNoteStatus(n) === "cancelada");
  }, [prevNotasFiltradas, getNoteStatus]);

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
      if (getNoteStatus(n) !== "válida") return false;
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
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, getDateField, getNoteStatus]);

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
      if (getNoteStatus(n) !== "válida") return false;
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
      if (searchCliente) {
        const query = searchCliente.toLowerCase();
        const clientMatch = n.cliente.toLowerCase().includes(query);
        const numberMatch = String(n.nNFSe || "").toLowerCase().includes(query);
        if (!clientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [todasNotas, empresaFiltro, anoFiltro, cServFiltro, searchCliente, anos, getDateField, getNoteStatus]);

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

  // Base de principais clientes (ignora filtros de período e serviço)
  const notasPrincipaisClientes = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (getNoteStatus(n) !== "válida") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      return true;
    });
  }, [todasNotas, empresaFiltro, getNoteStatus]);

  // Top clients by faturamento (matches Top Selling Products table style)
  const topClientesList = useMemo(() => {
    const map = new Map<string, { cnpjCpf: string; nome: string; total: number; count: number }>();
    notasPrincipaisClientes.forEach((n) => {
      const key = n.cnpjCpfCliente || "Desconhecido";
      const curr = map.get(key) || { cnpjCpf: key, nome: n.cliente || "Desconhecido", total: 0, count: 0 };
      curr.total += n.valor;
      curr.count += 1;
      map.set(key, curr);
    });
    
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [notasPrincipaisClientes]);

  // Cálculos de tributos
  // Regra definitiva (fonte da verdade = planilha):
  //   issRetido === "Sim" → ISS Retido na fonte (tomador recolhe)
  //   issRetido === "Não" → ISS a Recolher (prestador recolhe)
  // Usamos vlrIss como valor do ISS da nota.
  const issRetidoTotal = useMemo(() => {
    return notasAtivas.reduce(
      (sum, n) => (n.issRetido === "Sim" ? sum + (n.vlrIss ?? 0) : sum),
      0,
    );
  }, [notasAtivas]);

  const issARecolherTotal = useMemo(() => {
    return notasAtivas.reduce(
      (sum, n) => (n.issRetido === "Não" ? sum + (n.vlrIss ?? 0) : sum),
      0,
    );
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

  // Faturamento PJ vs PF (Categorizado: Empresarial, Adesão, Individual/Familiar)
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

  const runConciliation = useCallback(
    async (
      rows: ExcelRowData[],
      kCol: string,
      sCol: string,
      iCol: string,
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
        let statusExcel = parseExcelStatus(rawStatus);

        const rawIssRetido = iCol ? String(row[iCol] ?? "").trim() : "";
        const issRetidoExcel = iCol ? parseExcelIssRetido(rawIssRetido) : "Não";

        const local = localMap.get(key);

        const statusChanged = local ? local.status !== statusExcel : false;
        const issRetidoLocal = local ? (local.issRetido === "Sim" ? "Sim" : "Não") : "—";
        const issRetidoChanged = local && iCol ? issRetidoLocal !== issRetidoExcel : false;

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
          rawIssRetido,
          issRetidoExcel,
          issRetidoLocal,
          issRetidoChanged,
        };

        if (!local) {
          notFound++;
        } else if (res.statusChanged || res.issRetidoChanged) {
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

      // Tenta detectar colunas automaticamente pelo cabeçalho (nome da coluna)
      const detected = detectColumns(headers);

      // Usa o detectado ou cai para posição fixa como fallback
      const kCol = detected.keyColumn ?? (headers.length > 0 ? headers[0] : "");
      const sCol = detected.statusColumn ?? (headers.length > 5 ? headers[5] : headers.length > 1 ? headers[1] : "");
      const issColDefault = detected.issColumn ?? (headers.length > 6 ? headers[6] : "");
      setKeyCol(kCol);
      setStatusCol(sCol);
      setIssCol(issColDefault);

      if (kCol && sCol && todasNotas) {
        runConciliation(rows, kCol, sCol, issColDefault, todasNotas);
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
      (item) => (item.statusChanged || item.issRetidoChanged) && item.notaId,
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
            if (item.issRetidoChanged && item.issRetidoExcel) {
              updates.issRetido = item.issRetidoExcel;
              // Recalcula vlrIssRet e vlrIssRecolher com base no novo issRetido
              // vlrIss já contém o valor correto do ISS da nota
              const nota = todasNotas?.find((n) => n.id === item.notaId);
              const vlrIss = nota?.vlrIss ?? 0;
              if (item.issRetidoExcel === "Sim") {
                updates.vlrIssRet = vlrIss;
                updates.vlrIssRecolher = 0;
              } else {
                updates.vlrIssRet = 0;
                updates.vlrIssRecolher = vlrIss;
              }
            }

            if (Object.keys(updates).length > 0) {
              await db.notas.update(item.notaId, updates);
            }
          }
        }
      });
      addActivity("update", "Divergências Aplicadas", `${changes.length} nota(s) retificada(s) no banco local.`);
      setRightPanelOpen(true);
      toast.success("Divergências retificadas no banco de dados local!");
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
      "Status Divergente",
      "ISS Retido Planilha",
      "ISS Retido Local",
      "ISS Retido Divergente",
      "Divergência Total",
    ];
    const rows = conciliatedItems.map((item) => [
      item.rowNumber,
      item.rawKey,
      item.normalizedKey,
      item.nNFSe,
      item.prestador,
      item.statusExcel,
      item.statusLocal === "nao_encontrado" ? "Não Encontrado" : item.statusLocal,
      item.statusChanged ? "Sim" : "Não",
      item.issRetidoExcel || "—",
      item.issRetidoLocal || "—",
      item.issRetidoChanged ? "Sim" : "Não",
      (item.statusChanged || item.issRetidoChanged) ? "Sim" : "Não",
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
      runConciliation(xlsxRows, keyCol, statusCol, issCol, todasNotas);
    }
  }, [todasNotas, xlsxRows, keyCol, statusCol, issCol, runConciliation]);

  return (
    <div className="min-h-screen bg-background flex font-sans antialiased text-foreground w-full overflow-hidden transition-colors duration-300">
      <Toaster richColors position="top-right" />

      {/* LEFT SIDEBAR (ByeWind / SnowUI style) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-card border-r border-border flex flex-col justify-between transition-all duration-300 ease-in-out md:static flex-shrink-0 ${
          sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:border-r-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground leading-none">Smart Fiscal</h2>
              <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Diretoria BI</span>
            </div>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border border-border/40 mt-2">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              DS
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-foreground truncate">Diretoria Samel</p>
              <p className="text-[10px] text-muted-foreground truncate">diretoria@samel.com.br</p>
            </div>
          </div>

          {/* Regime de Data (Competência vs Emissão) */}
          <div className="flex flex-col gap-2 px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Regime de Data</span>
            <div className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl border border-border/40">
              <button
                onClick={() => {
                  setPeriodType("competencia");
                  addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                  toast.info("Regime de Data: Competência");
                }}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                  periodType === "competencia"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
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
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
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
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Favoritos</span>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all relative w-full text-left ${
                  activeTab === "dashboard"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {activeTab === "dashboard" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-indigo-600" />
                )}
                <LayoutDashboard className="h-4 w-4" /> Visão Geral Faturamento
              </button>
              <button
                onClick={() => setActiveTab("grupo")}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all relative w-full text-left ${
                  activeTab === "grupo"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {activeTab === "grupo" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-indigo-600" />
                )}
                <Building2 className="h-4 w-4" /> Faturamento do Grupo
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-all relative w-full text-left ${
                  activeTab === "conciliation"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {activeTab === "conciliation" && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-indigo-600" />
                )}
                <FileSpreadsheet className="h-4 w-4" /> Validador Sintético
              </button>
            </div>

            {/* Dashboards Category */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Dashboards</span>
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "dashboard" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4" /> Faturamento
                </div>
                {notasAtivas.length > 0 && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono border border-border/40">
                    {notasAtivas.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("grupo")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "grupo" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4" /> Resumo do Grupo
                </div>
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "conciliation" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4" /> Conciliador
                </div>
                {conciliatedStats.updated > 0 && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md font-mono">
                    {conciliatedStats.updated}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("tomados")}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  activeTab === "tomados" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4" /> Serviços Tomados
                </div>
                {(todasNotasTomadas?.length ?? 0) > 0 && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono border border-border/40">
                    {todasNotasTomadas!.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions Category */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Ações Rápidas</span>
              <button
                onClick={exportCsv}
                disabled={!notasFiltradas.length}
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-transparent w-full text-left"
              >
                <Download className="h-4 w-4" /> Exportar Relatório CSV
              </button>
              <button
                onClick={clearDb}
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all w-full text-left"
              >
                <Trash2 className="h-4 w-4" /> Limpar Base Local
              </button>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-medium">
          <span>v1.01 SPED</span>
          <span className="bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground">100% Local</span>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEBAR */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs md:hidden"
        />
      )}

      {/* OVERLAY FOR RIGHT PANEL / NOTIFICATION DRAWER */}
      {rightPanelOpen && (
        <div
          onClick={() => setRightPanelOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs"
        />
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* HEADER BAR (ByeWind Style) */}
        <header className="h-14 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0 transition-colors duration-300">
          {/* Header Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button className="text-muted-foreground/45 hover:text-amber-400 transition-colors hidden sm:block">
              <Star className="h-4 w-4 fill-current text-muted-foreground/30" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Dashboards</span>
              <span>/</span>
              <span className="text-foreground font-semibold">
                {activeTab === "dashboard" ? "Faturamento Geral" : "Validador Planilhas"}
              </span>
            </div>
          </div>

          {/* Header Right */}
          <div className="flex items-center gap-3">
            {/* Search Input Placeholder */}
            <div className="relative w-48 lg:w-64 hidden sm:block">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar cliente ou nº NFS..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="w-full h-8 pl-8 pr-10 rounded-lg bg-muted border border-border text-xs focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
              />
              <span className="absolute right-2.5 top-2 text-[9px] font-mono text-muted-foreground bg-muted-foreground/15 px-1 rounded-md">
                ⌘/
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={theme === "light" ? "Modo Escuro" : "Modo Claro"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Utility Icons */}
            <button
              onClick={() => addActivity("update", "Preferências Atualizadas", "O usuário atualizou as preferências do sistema.")}
              className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-4 w-4" />
            </button>

            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              {activities.length > 1 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
              )}
            </button>

            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hidden md:flex"
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
          
          {/* MOBILE TABS CONTROLLER (Fallback Tab List for small screens) */}
          <div className="flex justify-between items-center gap-4 flex-wrap md:hidden bg-card p-3 rounded-2xl border border-border shadow-sm">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Visualização</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "dashboard" ? "bg-foreground text-background shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                BI & Dashboards
              </button>
              <button
                onClick={() => setActiveTab("grupo")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "grupo" ? "bg-foreground text-background shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Faturamento Grupo
              </button>
              <button
                onClick={() => setActiveTab("conciliation")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "conciliation" ? "bg-foreground text-background shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Validador (.xlsx)
              </button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
            <TabsContent value="dashboard" className="space-y-6 mt-0 outline-none">
              
              {/* PAGE MAIN HEADER / FILTERS PANEL */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">Consulta de Faturamento</h1>
                  <p className="text-xs text-muted-foreground mt-1">Análise consolidada para a diretoria · Samel</p>
                </div>
                
                {/* Responsive Filter Grid */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Regime Toggle Pills */}
                  <div className="flex bg-muted p-1 rounded-xl border border-border/50 mr-1">
                    <button
                      onClick={() => {
                        setPeriodType("competencia");
                        addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                        toast.info("Regime de Data: Competência");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodType === "competencia"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
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
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Emissão
                    </button>
                  </div>

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
                onClick={() => fileRef.current?.click()}
                className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-300 ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 scale-[1.005] shadow-sm"
                    : "border-border bg-card text-card-foreground hover:border-indigo-500/50 hover:bg-slate-50/30 dark:hover:bg-slate-800/10"
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

              {/* METRICS / KPI GRID (ByeWind style: clean card layout, light pastel colors, trend arrows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
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
                
                {/* Faturamento Line Chart (ByeWind Image 1 line chart layout) */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-12 transition-colors duration-300">
                  <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Evolução do Faturamento</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Comparativo do faturamento com o período imediatamente anterior</p>
                    </div>
                    {/* Legend keys matching image 1 & 2 */}
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
                                  `Dashboard filtrado para o mês de ${state.activeLabel} via clique no gráfico.`
                                );
                                toast.success(`Filtrado pelo mês: ${state.activeLabel}`);
                              }
                            }
                          }}
                        >
                          <defs>
                            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
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
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)"
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

              {/* SECONDARY CHARTS GRID (Donut Charts & Top Clients Table) */}
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
                                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Legend aligned on the side/bottom */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total</span>
                          <span className="text-sm font-extrabold text-foreground">
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
                                ? `${(item.value / 1000000).toFixed(1).replace('.', ',')} mi`
                                : item.value >= 1000 
                                  ? `${(item.value / 1000).toFixed(1).replace('.', ',')} k`
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
                                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
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
                    {comparativoServicosData.filter(d => d.value > 0).map((item, idx) => (
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

                {/* Top Clients Table (ByeWind "Top Selling Products" style from Image 2) */}
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
                  
                  {/* Search and Period Filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por cliente ou nº NFS..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        className="pl-8 h-8 rounded-lg text-xs bg-muted border-border hover:bg-muted/80 focus:bg-card placeholder:text-muted-foreground w-full"
                      />
                    </div>
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
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}>
                              {n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
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
            </TabsContent>

            <TabsContent value="grupo" className="space-y-6 mt-0 outline-none">
              {/* PAGE MAIN HEADER / FILTERS PANEL */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">Resumo Consolidado do Grupo</h1>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Faturamento consolidado do grupo · Filtros de empresa individual e busca são ignorados
                  </p>
                </div>
                
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Regime Toggle Pills */}
                  <div className="flex bg-muted p-1 rounded-xl border border-border/50 mr-1">
                    <button
                      onClick={() => {
                        setPeriodType("competencia");
                        addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                        toast.info("Regime de Data: Competência");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodType === "competencia"
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
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
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Emissão
                    </button>
                  </div>

                  {/* Month Select */}
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

                  {/* Year Select */}
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

                  {/* Service Select */}
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

              {/* METRICS / KPI GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KpiCardNew
                  label="Faturamento Bruto do Grupo"
                  value={fmtBRL(groupStats.totalGroupBilling)}
                  trendText="Consolidado"
                  isPositive={true}
                  subtext="Soma de todas as NFS-e válidas"
                  tone="blue"
                />
                <KpiCardNew
                  label="Eliminação Intergrupo"
                  value={fmtBRL(groupStats.totalIntergrupoBilling)}
                  trendText={`${(groupStats.totalGroupBilling > 0 ? (groupStats.totalIntergrupoBilling / groupStats.totalGroupBilling * 100) : 0).toFixed(1)}%`}
                  isPositive={false}
                  subtext="Faturamento entre empresas do grupo"
                  tone="rose"
                />
                <KpiCardNew
                  label="Faturamento Líquido (Externo)"
                  value={fmtBRL(groupStats.totalExternalBilling)}
                  trendText={`${(groupStats.totalGroupBilling > 0 ? (groupStats.totalExternalBilling / groupStats.totalGroupBilling * 100) : 0).toFixed(1)}%`}
                  isPositive={true}
                  subtext="Faturamento gerado com terceiros"
                  tone="green"
                />
                <KpiCardNew
                  label="Transações Intergrupo"
                  value={`${groupStats.intergroupNotes.length} notas`}
                  trendText="Interno"
                  isPositive={true}
                  subtext="Notas emitidas entre empresas do grupo"
                  tone="amber"
                />
              </div>

              {/* Evolução do Faturamento Mensal do Grupo */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300">
                <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Evolução Mensal do Faturamento do Grupo</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Faturamento bruto consolidado, faturamento líquido e eliminações intergrupo</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1]" />
                      <span>Faturamento Bruto</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                      <span>Faturamento Líquido (Externo)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                      <span>Eliminação Intergrupo</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-[280px]">
                  {groupLineChartData.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={groupLineChartData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorIntergrupo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="Faturamento Bruto"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorBruto)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Faturamento Líquido"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorLiquido)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Faturamento Intergrupo"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          fillOpacity={1}
                          fill="url(#colorIntergrupo)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ANALYTICS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recharts Stacked Bar Chart */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-7 transition-colors duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-1">Faturamento por Empresa</h3>
                  <p className="text-[10px] text-muted-foreground mb-4">Breakdown por faturamento externo e transações internas (intergrupo)</p>
                  
                  <div className="h-[320px]">
                    {groupStats.companyList.length === 0 ? (
                      <EmptyState />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={groupStats.companyList}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" opacity={0.4} />
                          <XAxis
                            type="number"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) =>
                              v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="nome"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            width={130}
                            tickFormatter={(name) => {
                              if (name.length > 20) return `${name.substring(0, 18)}...`;
                              return name;
                            }}
                          />
                          <Tooltip
                            formatter={(v) => fmtBRL(Number(v))}
                            contentStyle={{
                              backgroundColor: "var(--color-popover)",
                              borderColor: "var(--color-border)",
                              borderRadius: 12,
                              color: "var(--color-foreground)",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                          <Bar dataKey="externo" name="Faturamento Externo" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="intergrupo" name="Faturamento Intergrupo" stackId="a" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Company Share Breakdown List */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-5 flex flex-col justify-between transition-colors duration-300">
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-1">Participação no Faturamento</h3>
                    <p className="text-[10px] text-muted-foreground mb-4">Share de cada empresa sobre o faturamento bruto consolidado do grupo</p>
                    
                    <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                      {groupStats.companyList.length === 0 ? (
                        <EmptyState />
                      ) : (
                        groupStats.companyList.map((c, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground/90 truncate max-w-[200px]" title={c.nome}>
                                {c.nome}
                              </span>
                              <span className="font-bold text-foreground">{c.share.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${c.share}%` }} />
                            </div>
                            <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                              <span>Externo: {fmtBRL(c.externo)}</span>
                              <span>Intergrupo: {fmtBRL(c.intergrupo)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TABLE: RESUMO POR EMPRESA */}
              <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
                <div className="p-5 border-b border-border">
                  <h3 className="text-xs font-bold text-foreground">Resumo por Empresa do Grupo</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Visão consolidada das notas válidas e seus faturamentos brutos e líquidos</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border">
                        <TableHead className="font-medium text-muted-foreground h-9">Empresa</TableHead>
                        <TableHead className="font-medium text-muted-foreground h-9 text-center">Qtd. Notas</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground h-9">Faturamento Bruto</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground h-9">Eliminação Intergrupo</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground h-9">Faturamento Líquido (Externo)</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground h-9">Share %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStats.companyList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                            Nenhuma empresa identificada com notas válidas no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupStats.companyList.map((c, idx) => (
                          <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                            <TableCell className="max-w-[200px]">
                              <div className="font-semibold text-foreground/90 truncate" title={c.nome}>{c.nome}</div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{formatarCnpjCpf(c.cnpj)}</div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-[10px] text-muted-foreground">{c.count}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground">{fmtBRL(c.total)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400 font-semibold">{fmtBRL(c.intergrupo)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{fmtBRL(c.externo)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-foreground/85 font-semibold">{c.share.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* TABLE: NOTAS INTERGRUPO */}
              <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
                <div className="p-5 border-b border-border">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Notas Emitidas entre Empresas do Grupo ({groupStats.intergroupNotes.length})
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Notas fiscais onde o prestador e o tomador são empresas pertencentes ao grupo</p>
                </div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border">
                        <TableHead className="font-medium text-muted-foreground h-9">Nº NFS</TableHead>
                        <TableHead className="font-medium text-muted-foreground h-9">Emissão</TableHead>
                        <TableHead className="font-medium text-muted-foreground h-9">Prestador (Emitente)</TableHead>
                        <TableHead className="font-medium text-muted-foreground h-9">Tomador (Destinatário)</TableHead>
                        <TableHead className="text-right font-medium text-muted-foreground h-9">Valor do Serviço</TableHead>
                        <TableHead className="font-medium text-muted-foreground h-9">Serviço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStats.intergroupNotes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                            Nenhuma transação intergrupo identificada para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupStats.intergroupNotes.map((n, idx) => (
                          <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                            <TableCell className="font-mono text-[10px] text-foreground/95 font-semibold">{n.nNFSe}</TableCell>
                            <TableCell className="text-xs text-foreground/90 whitespace-nowrap">{formatarData(n.dhEmi)}</TableCell>
                            <TableCell className="max-w-[220px] truncate">
                              <div className="font-semibold text-foreground/90 truncate" title={n.nomePrestador || n.cnpjPrestador}>
                                {n.nomePrestador || n.cnpjPrestador}
                              </div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                {formatarCnpjCpf(n.cnpjPrestador)}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate">
                              <div className="font-semibold text-foreground/90 truncate" title={n.tomadorNome}>
                                {n.tomadorNome}
                              </div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                {formatarCnpjCpf(n.cnpjCpfCliente)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">{fmtBRL(n.valor)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}>
                              {n.codTribNacional ? `${n.codTribNacional} - ${getServicoDescricao(n.codTribNacional)}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
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
                className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-300 ${
                  xlsxDragOver
                    ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 scale-[1.005] shadow-sm"
                    : "border-border bg-card text-card-foreground hover:border-indigo-500/50 hover:bg-slate-50/30 dark:hover:bg-slate-800/10"
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
                      <p className="font-semibold text-xs text-foreground">Conciliando Planilha de Faturamento...</p>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      {xlsxFile ? (
                        <>
                          <p className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">{xlsxFile.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Clique ou arraste outro arquivo para substituir
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-xs text-foreground">
                            Arraste a planilha de fechamento fiscal (.xlsx) aqui ou clique para selecionar
                          </p>
                          <p className="text-[10px] text-muted-foreground">
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
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-4 flex flex-col gap-4 transition-colors duration-300">
                      <div>
                        <h3 className="text-xs font-bold text-foreground">Mapeamento de Planilha</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Identifique as colunas de referência do seu relatório Excel</p>
                      </div>

                      <div className="space-y-3 mt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Coluna Chave de Acesso</label>
                          <Select value={keyCol} onValueChange={(val) => setKeyCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
                              {xlsxHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Coluna Status / Situação</label>
                          <Select value={statusCol} onValueChange={(val) => setStatusCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
                              {xlsxHeaders.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Coluna ISS (Retido / a Recolher)</label>
                          <Select value={issCol} onValueChange={(val) => setIssCol(val)}>
                            <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
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
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between bg-card transition-colors duration-300">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Divergentes / Retificáveis</p>
                          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{conciliatedStats.updated}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Diferem das notas no banco local</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <AlertTriangle className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Correct / Conciliated Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between bg-card transition-colors duration-300">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Já Conciliadas</p>
                          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{conciliatedStats.alreadyCorrect}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Alinhadas com banco local</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Check className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Missing Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between bg-card transition-colors duration-300">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Não Encontradas</p>
                          <p className="text-2xl font-extrabold text-rose-500 dark:text-rose-400 mt-1">{conciliatedStats.notFound}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Inexistentes no banco de dados</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 dark:text-rose-400">
                          <XCircle className="h-4.5 w-4.5" />
                        </div>
                      </div>

                      {/* Total Processed Card */}
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between bg-card transition-colors duration-300">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Processado</p>
                          <p className="text-2xl font-extrabold text-foreground mt-1">{conciliatedStats.total}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Linhas identificadas na planilha</p>
                        </div>
                        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                          <FileSpreadsheet className="h-4.5 w-4.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RESULTS TABLE */}
                  <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
                    <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="text-xs font-bold text-foreground">Resultados da Validação Sintética</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Auditoria linha a linha entre planilha (.xlsx) e XMLs locais</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={applyUpdates}
                          disabled={conciliatedStats.updated === 0}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs h-8 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5 mr-1.5" /> Retificar Status no Banco
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportValidationCsv}
                          disabled={conciliatedItems.length === 0}
                          className="border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs h-8 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar Relatório de Divergências
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="border-b border-border">
                            <TableHead className="font-medium text-muted-foreground h-9">Linha</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Chave de Acesso</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Nº NFS-e</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Prestador</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Status (Planilha | Local)</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">ISS Retido (Planilha | Local)</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Auditoria</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conciliatedItems.map((item, idx) => (
                            <TableRow
                              key={idx}
                              className={`border-b border-border/50 hover:bg-muted/40 transition-colors ${
                                item.statusChanged || item.issRetidoChanged ? "bg-amber-500/5 hover:bg-amber-500/10" : ""
                              }`}
                            >
                              <TableCell className="font-mono text-[10px] text-muted-foreground">{item.rowNumber}</TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[220px] truncate" title={item.rawKey}>
                                {item.rawKey}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-foreground font-semibold">{item.nNFSe}</TableCell>
                              <TableCell className="text-xs text-foreground/90 max-w-[150px] truncate" title={item.prestador}>
                                {item.prestador}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.statusExcel === "válida" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                                    {item.statusExcel === "válida" ? "Válida" : "Canc."}
                                  </span>
                                  <span className="text-border">|</span>
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-muted-foreground text-[9px] font-medium">Inexistente</span>
                                  ) : (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.statusLocal === "válida" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                                      {item.statusLocal === "válida" ? "Válida" : "Canc."}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.issRetidoExcel === "Sim" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-muted text-muted-foreground"}`}>
                                    {item.issRetidoExcel === "Sim" ? "Retido" : "Não Ret."}
                                  </span>
                                  <span className="text-border">|</span>
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-muted-foreground text-[9px] font-medium">Inexistente</span>
                                  ) : (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${item.issRetidoLocal === "Sim" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-muted text-muted-foreground"}`}>
                                      {item.issRetidoLocal === "Sim" ? "Retido" : "Não Ret."}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-semibold">
                                {item.statusLocal === "nao_encontrado" ? (
                                  <span className="text-rose-500 text-[10px] font-semibold flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Inexistente no Banco
                                  </span>
                                ) : item.statusChanged && item.issRetidoChanged ? (
                                  <span className="text-amber-600 text-[10px] font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Status & ISS divergentes
                                  </span>
                                ) : item.statusChanged ? (
                                  <span className="text-amber-600 text-[10px] font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Status divergente
                                  </span>
                                ) : item.issRetidoChanged ? (
                                  <span className="text-amber-600 text-[10px] font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5" /> ISS Retido divergente
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

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ABA: SERVIÇOS TOMADOS                                       */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "tomados" && (() => {
              // ── Derived data ─────────────────────────────────────────
              const notasTomValidas = (todasNotasTomadas ?? []).filter((n) => {
                if (n.status !== "válida") return false;
                const ds = (n.dCompet || n.dhEmi || "").slice(0, 10);
                if (mesFiltroTomadas !== "__all__" && ds.slice(5, 7) !== mesFiltroTomadas) return false;
                if (anoFiltroTomadas !== "__all__" && ds.slice(0, 4) !== anoFiltroTomadas) return false;
                if (empresaFiltroTomadas !== "__all__" && n.cnpjTomador !== empresaFiltroTomadas) return false;
                return true;
              });

              const totalTomados = notasTomValidas.reduce((s, n) => s + n.valor, 0);
              const fornecedoresAtivos = new Set(notasTomValidas.map((n) => n.cnpjPrestador)).size;
              const ticketMedioFornecedor = fornecedoresAtivos > 0 ? totalTomados / fornecedoresAtivos : 0;
              const issRetidoTomadaTotal = notasTomValidas.reduce((s, n) => n.issRetido === "Sim" ? s + n.vlrIssRet : s, 0);
              const irrfTotal = notasTomValidas.reduce((s, n) => s + (n.vlrIrrf ?? 0), 0);
              const csllTotal = notasTomValidas.reduce((s, n) => s + (n.vlrCsll ?? 0), 0);
              const pisTotal  = notasTomValidas.reduce((s, n) => s + (n.vlrPis  ?? 0), 0);
              const cofinsTotal = notasTomValidas.reduce((s, n) => s + (n.vlrCofins ?? 0), 0);
              const inssTotal = notasTomValidas.reduce((s, n) => s + (n.vlrInss ?? 0), 0);
              const totalRetencoes = issRetidoTomadaTotal + irrfTotal + csllTotal + pisTotal + cofinsTotal + inssTotal;

              // Anos/meses disponíveis para filtros
              const anosDisp = Array.from(new Set((todasNotasTomadas ?? []).map((n) => (n.dCompet || n.dhEmi || "").slice(0, 4)).filter(Boolean))).sort().reverse();
              const tomadoresDist = Array.from(new Set((todasNotasTomadas ?? []).map((n) => n.cnpjTomador).filter(Boolean)));

              // Gráfico A — evolução mensal
              const evolucaoMap = new Map<string, number>();
              notasTomValidas.forEach((n) => {
                const key = (n.dCompet || n.dhEmi || "").slice(0, 7);
                if (key) evolucaoMap.set(key, (evolucaoMap.get(key) ?? 0) + n.valor);
              });
              const evolucaoData = Array.from(evolucaoMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
                label: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(k.slice(5,7))-1] + "/" + k.slice(2,4),
                valor: v,
              }));

              // Gráfico B — distribuição por categoria de serviço (derivada da descrição)
              const servicoMap = new Map<string, number>();
              notasTomValidas.forEach((n) => {
                const key = categorizarServico(n.servico);
                servicoMap.set(key, (servicoMap.get(key) ?? 0) + n.valor);
              });
              const SERV_COLORS = ["#6366f1","#14b8a6","#f59e0b","#ec4899","#8b5cf6","#ef4444"];
              const servicoEntries = Array.from(servicoMap.entries()).sort(([,a],[,b]) => b-a);
              const topServicos = servicoEntries.slice(0, 5);
              const outrosServ = servicoEntries.slice(5).reduce((s,[,v]) => s+v, 0);
              const servicoData = [...topServicos.map(([k,v],i)=>({name:k,value:v,fill:SERV_COLORS[i]})), ...(outrosServ > 0 ? [{name:"Outros",value:outrosServ,fill:SERV_COLORS[5]}] : [])];

              // Gráfico C — top 8 fornecedores
              const fornMap = new Map<string, { nome: string; total: number }>();
              notasTomValidas.forEach((n) => {
                const entry = fornMap.get(n.cnpjPrestador) ?? { nome: n.nomePrestador, total: 0 };
                fornMap.set(n.cnpjPrestador, { ...entry, total: entry.total + n.valor });
              });
              const topFornecedores = Array.from(fornMap.values()).sort((a,b)=>b.total-a.total).slice(0,8);

              // Gráfico D — retenções mensais empilhadas
              const retMap = new Map<string, { ISS: number; IRRF: number; CSPN: number; INSS: number }>();
              notasTomValidas.forEach((n) => {
                const key = (n.dCompet || n.dhEmi || "").slice(0, 7);
                if (!key) return;
                const e = retMap.get(key) ?? { ISS: 0, IRRF: 0, CSPN: 0, INSS: 0 };
                retMap.set(key, {
                  ISS:  e.ISS  + (n.issRetido === "Sim" ? n.vlrIssRet : 0),
                  IRRF: e.IRRF + (n.vlrIrrf ?? 0),
                  CSPN: e.CSPN + (n.vlrCsll ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0),
                  INSS: e.INSS + (n.vlrInss ?? 0),
                });
              });
              const retData = Array.from(retMap.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([k,v]) => ({
                label: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(k.slice(5,7))-1] + "/" + k.slice(2,4),
                ...v,
              }));

              // Paginação tabela
              const totalPagesTomadas = Math.ceil(notasTomValidas.length / PAGE_SIZE_TOMADAS);
              const paginatedTomadas = notasTomValidas.slice((pageTomadas-1)*PAGE_SIZE_TOMADAS, pageTomadas*PAGE_SIZE_TOMADAS);

              const nomeTomadorLabel = (cnpj: string) => {
                const n = (todasNotasTomadas ?? []).find((x) => x.cnpjTomador === cnpj);
                return n?.nomeTomador || cnpj;
              };

              return (
                <div className="space-y-6 mt-0">

                  {/* Header + Filtros */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs">
                    <div>
                      <h1 className="text-xl font-bold tracking-tight text-foreground">Serviços Tomados</h1>
                      <p className="text-xs text-muted-foreground mt-1">NFS-e recebidas de fornecedores onde o grupo Samel é tomador · Obrigações de retenção na fonte</p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Select value={empresaFiltroTomadas} onValueChange={(v) => { setEmpresaFiltroTomadas(v); setPageTomadas(1); }}>
                        <SelectTrigger className="w-[200px] h-9 text-xs rounded-xl bg-muted border-border">
                          <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                          <SelectValue placeholder="Empresa Tomadora" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__all__">Todas as Tomadoras</SelectItem>
                          {tomadoresDist.map((cnpj) => (
                            <SelectItem key={cnpj} value={cnpj}>{nomeTomadorLabel(cnpj)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={mesFiltroTomadas} onValueChange={(v) => { setMesFiltroTomadas(v); setPageTomadas(1); }}>
                        <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-muted border-border">
                          <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__all__">Todos os Meses</SelectItem>
                          {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i)=>(
                            <SelectItem key={m} value={m}>{["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][i]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={anoFiltroTomadas} onValueChange={(v) => { setAnoFiltroTomadas(v); setPageTomadas(1); }}>
                        <SelectTrigger className="w-[105px] h-9 text-xs rounded-xl bg-muted border-border">
                          <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__all__">Todos os Anos</SelectItem>
                          {anosDisp.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Upload ZIP */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverTomadas(true); }}
                    onDragLeave={() => setDragOverTomadas(false)}
                    onDrop={onDropTomadas}
                    onClick={() => fileRefTomadas.current?.click()}
                    className={`rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all duration-300 ${
                      dragOverTomadas ? "border-teal-500 bg-teal-500/5 scale-[1.005] shadow-sm" : "border-border bg-card hover:border-teal-500/50 hover:bg-slate-50/30 dark:hover:bg-slate-800/10"
                    }`}
                  >
                    <input ref={fileRefTomadas} type="file" accept=".zip" multiple className="hidden" onChange={(e) => e.target.files && processFilesTomadas(e.target.files)} />
                    <div className="flex flex-col items-center gap-2">
                      {importingTomadas ? (
                        <>
                          <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
                          <p className="font-semibold text-xs text-foreground">Processando XMLs de Serviços Tomados...</p>
                          {progressTomadas && <p className="text-[10px] text-muted-foreground">{progressTomadas.done} / {progressTomadas.total} XMLs</p>}
                        </>
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                          </div>
                          <p className="font-semibold text-xs text-foreground">Arraste ZIPs com NFS-e recebidas de fornecedores</p>
                          <p className="text-[10px] text-muted-foreground">O sistema identificará automaticamente as notas onde o CNPJ do grupo aparece como tomador</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    {([
                      { label: "Total de Serviços Tomados", value: fmtBRL(totalTomados), sub: "valor bruto consolidado", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
                      { label: "Fornecedores Ativos", value: fornecedoresAtivos.toLocaleString("pt-BR"), sub: "prestadores distintos no período", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
                      { label: "Notas Recebidas", value: notasTomValidas.length.toLocaleString("pt-BR"), sub: "NFS-e válidas do período", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
                      { label: "Ticket Médio / Fornecedor", value: fmtBRL(ticketMedioFornecedor), sub: "valor médio contratado por fornecedor", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
                      { label: "Total de Retenções", value: fmtBRL(totalRetencoes), sub: "obrigações de retenção na fonte", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
                    ] as const).map((kpi, i) => (
                      <div key={i} className="p-4 sm:p-5 rounded-2xl border bg-card flex flex-col justify-between shadow-xs border-border transition-all hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                            <p className="text-lg sm:text-xl font-extrabold text-foreground mt-1.5">{kpi.value}</p>
                          </div>
                          <div className={`h-8 w-8 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                            <ShoppingBag className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Painel de Retenções */}
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Obrigações de Retenção na Fonte</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {([
                        { label: "ISS Retido", value: issRetidoTomadaTotal, hint: "Retido pelo tomador (Samel)", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
                        { label: "IRRF", value: irrfTotal, hint: "Imposto de Renda Retido na Fonte", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
                        { label: "CSLL", value: csllTotal, hint: "Contrib. Social s/ Lucro Líquido", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
                        { label: "PIS", value: pisTotal, hint: "Prog. de Integração Social", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
                        { label: "COFINS", value: cofinsTotal, hint: "Contrib. p/ Financiamento Seguridade", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                        { label: "INSS/CPRB", value: inssTotal, hint: "Retenção previdenciária", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
                      ] as const).map((item, i) => (
                        <div key={i} className={`p-3 rounded-xl border border-border/50 ${item.bg} flex flex-col gap-1`}>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{item.label}</p>
                          <p className={`text-sm font-bold ${item.color}`}>{fmtBRL(item.value)}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">{item.hint}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gráficos: Evolução + Distribuição */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico A — Evolução mensal */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-2">
                      <h3 className="text-xs font-bold text-foreground mb-1">Evolução dos Serviços Tomados</h3>
                      <p className="text-[10px] text-muted-foreground mb-4">Valor total mensal de NFS-e recebidas</p>
                      <div className="h-[240px]">
                        {evolucaoData.length === 0 ? <EmptyState /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolucaoData}>
                              <defs>
                                <linearGradient id="colorTomadas" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `R$ ${(v/1000000).toFixed(1)}M` : `R$ ${(v/1000).toFixed(0)}k`} />
                              <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                              <Area type="monotone" dataKey="valor" stroke="#14b8a6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTomadas)" name="Serviços Tomados" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* Gráfico B — Distribuição por tipo de serviço */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                      <h3 className="text-xs font-bold text-foreground mb-1">Por Tipo de Serviço</h3>
                      <p className="text-[10px] text-muted-foreground mb-4">Distribuição por código tributário</p>
                      <div className="h-[180px] relative flex items-center justify-center">
                        {servicoData.length === 0 ? <EmptyState /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={servicoData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="var(--color-card)" strokeWidth={3}>
                                {servicoData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                              </Pie>
                              <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-border/50">
                        {servicoData.slice(0,4).map((d,i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.fill }} />{d.name.slice(0,20)}</span>
                            <span className="font-bold text-foreground">{fmtBRL(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gráficos: Top Fornecedores + Retenções Mensais */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Gráfico C — Top Fornecedores */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                      <h3 className="text-xs font-bold text-foreground mb-1">Top Fornecedores</h3>
                      <p className="text-[10px] text-muted-foreground mb-4">Maiores prestadores por volume contratado</p>
                      <div className="h-[260px]">
                        {topFornecedores.length === 0 ? <EmptyState /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topFornecedores} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" opacity={0.4} />
                              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`} />
                              <YAxis type="category" dataKey="nome" stroke="var(--color-muted-foreground)" fontSize={9} axisLine={false} tickLine={false} width={110} tickFormatter={(v: string) => v.length > 18 ? v.slice(0,18)+"…" : v} />
                              <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                              <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} name="Valor" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* Gráfico D — Retenções mensais empilhadas */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                      <h3 className="text-xs font-bold text-foreground mb-1">Retenções por Competência</h3>
                      <p className="text-[10px] text-muted-foreground mb-4">ISS, IRRF, CSLL/PIS/COFINS e INSS empilhados</p>
                      <div className="h-[260px]">
                        {retData.length === 0 ? <EmptyState /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={retData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                              <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ backgroundColor: "var(--color-popover)", borderColor: "var(--color-border)", borderRadius: 12, color: "var(--color-foreground)" }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="ISS"  stackId="ret" fill="#6366f1" name="ISS" />
                              <Bar dataKey="IRRF" stackId="ret" fill="#f59e0b" name="IRRF" />
                              <Bar dataKey="CSPN" stackId="ret" fill="#14b8a6" name="CSLL/PIS/COFINS" />
                              <Bar dataKey="INSS" stackId="ret" fill="#ec4899" name="INSS" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Notas Tomadas */}
                  <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        NFS-e Recebidas de Fornecedores ({notasTomValidas.length.toLocaleString("pt-BR")})
                      </h3>
                      {(todasNotasTomadas?.length ?? 0) > 0 && (
                        <button
                          onClick={async () => { await db.notasTomadas.clear(); toast.success("Base de serviços tomados limpa."); }}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Limpar Base
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[1200px]">
                        <TableHeader className="bg-muted/30">
                          <TableRow className="border-b border-border">
                            <TableHead className="font-medium text-muted-foreground h-9">Situação</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Nº NFS-e</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Competência</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">CNPJ Prestador</TableHead>
                            <TableHead className="font-medium text-muted-foreground h-9">Fornecedor</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Bruto</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. Líquido</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">Vlr. ISS</TableHead>
                            <TableHead className="text-center font-medium text-muted-foreground h-9">ISS Retido?</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">IRRF</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">CSLL</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">PIS</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">COFINS</TableHead>
                            <TableHead className="text-right font-medium text-muted-foreground h-9">INSS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTomadas.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={14} className="text-center text-muted-foreground py-12 text-xs">
                                {(todasNotasTomadas?.length ?? 0) === 0
                                  ? "Nenhum serviço tomado importado. Arraste um ZIP acima para começar."
                                  : "Nenhum resultado para os filtros selecionados."}
                              </TableCell>
                            </TableRow>
                          ) : paginatedTomadas.map((n, i) => (
                            <TableRow key={n.id} className={`border-b border-border/40 text-xs hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${n.status === "válida" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                                  {n.status === "válida" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                                  {n.status === "válida" ? "Válida" : "Cancelada"}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-[10px]">{n.nNFSe}</TableCell>
                              <TableCell className="text-muted-foreground">{n.dCompet ? n.dCompet.slice(0,7) : "—"}</TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">{n.cnpjPrestador}</TableCell>
                              <TableCell className="max-w-[140px] truncate font-medium" title={n.nomePrestador}>{n.nomePrestador}</TableCell>
                              <TableCell className="text-right font-bold">{fmtBRL(n.valor)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{fmtBRL(n.vlrLiquido)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.issRetido === "Sim" && n.vlrIssRet > 0 ? fmtBRL(n.vlrIssRet) : "—"}</TableCell>
                              <TableCell className="text-center">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${n.issRetido === "Sim" ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-muted text-muted-foreground"}`}>
                                  {n.issRetido}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.vlrIrrf > 0 ? fmtBRL(n.vlrIrrf) : "—"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.vlrCsll > 0 ? fmtBRL(n.vlrCsll) : "—"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.vlrPis > 0 ? fmtBRL(n.vlrPis) : "—"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.vlrCofins > 0 ? fmtBRL(n.vlrCofins) : "—"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{n.vlrInss > 0 ? fmtBRL(n.vlrInss) : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Paginação */}
                    {totalPagesTomadas > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
                        <span>{notasTomValidas.length.toLocaleString("pt-BR")} registros · Página {pageTomadas} de {totalPagesTomadas}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPageTomadas((p) => Math.max(1, p-1))} disabled={pageTomadas === 1} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/80 disabled:opacity-40">
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setPageTomadas((p) => Math.min(totalPagesTomadas, p+1))} disabled={pageTomadas === totalPagesTomadas} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted/80 disabled:opacity-40">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}

          </Tabs>

          <footer className="text-center text-[10px] text-muted-foreground pt-8 mt-12 border-t border-border/80">
            🔒 Processamento 100% Client-Side local — Seus XMLs NFS-e e planilhas financeiras nunca saem do seu navegador.
          </footer>
        </main>
      </div>

      {/* RIGHT PANEL: ALERTS & ACTIVITIES (ByeWind style: clean drawer sliding from right) */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 bg-card border-l border-border w-80 flex flex-col justify-between transition-transform duration-300 ease-in-out transform shadow-xl md:shadow-none flex-shrink-0 ${
          rightPanelOpen ? "translate-x-0 animate-in slide-in-from-right duration-300" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div>
              <h3 className="text-xs font-bold text-foreground">Alertas & Atividades</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Linha do tempo de auditorias e importações</p>
            </div>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Histórico Recente</h4>
            
            <div className="relative pl-4 border-l border-border flex flex-col gap-5">
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
                    <span className={`absolute -left-[20px] top-1.5 h-2 w-2 rounded-full ring-4 ring-card ${colors[act.type] || "bg-slate-400"}`} />
                    
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground leading-tight">{act.title}</span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{act.description}</p>
                      <span className="text-[9px] text-muted-foreground/85 font-mono mt-1">
                        {act.time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Team Contacts (ByeWind style: Contacts section at the bottom) */}
          <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-border">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipe Financeira</h4>
            
            <div className="flex flex-col gap-3">
              <ContactItem name="Natali Craig" role="Contadora Líder Samel" avatarText="NC" />
              <ContactItem name="Drew Cano" role="Diretor Financeiro" avatarText="DC" />
              <ContactItem name="Orlando Diggs" role="Analista Fiscal" avatarText="OD" />
              <ContactItem name="Andi Lane" role="Auditor Externo" avatarText="AL" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border text-center text-[10px] text-muted-foreground font-medium bg-muted/20">
          Auditoria de Fechamento Executivo
        </div>
      </aside>
    </div>
  );
}

// Sub-components helper for Contacts
function ContactItem({ name, role, avatarText }: { name: string; role: string; avatarText: string }) {
  return (
    <div className="flex items-center gap-2.5 p-1 hover:bg-muted rounded-lg transition-colors cursor-pointer">
      <div className="h-7 w-7 rounded-full bg-muted text-[10px] font-bold text-foreground flex items-center justify-center flex-shrink-0">
        {avatarText}
      </div>
      <div className="overflow-hidden">
        <p className="text-[11px] font-bold text-foreground leading-tight truncate">{name}</p>
        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{role}</p>
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
  const borderColors = {
    blue: "border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-800/60",
    purple: "border-purple-100 dark:border-purple-900/50 hover:border-purple-300 dark:hover:border-purple-800/60",
    green: "border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-800/60",
    rose: "border-rose-100 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800/60",
    amber: "border-amber-100 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800/60",
  };

  const glowEffects = {
    blue: "hover:shadow-[0_8px_30px_rgba(59,130,246,0.06)] dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.03)]",
    purple: "hover:shadow-[0_8px_30px_rgba(139,92,246,0.06)] dark:hover:shadow-[0_8px_30px_rgba(139,92,246,0.03)]",
    green: "hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)] dark:hover:shadow-[0_8px_30px_rgba(16,185,129,0.03)]",
    rose: "hover:shadow-[0_8px_30px_rgba(239,68,68,0.06)] dark:hover:shadow-[0_8px_30px_rgba(239,68,68,0.03)]",
    amber: "hover:shadow-[0_8px_30px_rgba(245,158,11,0.06)] dark:hover:shadow-[0_8px_30px_rgba(245,158,11,0.03)]",
  };

  const isLong = value.length > 12;
  const isVeryLong = value.length > 16;
  const valueFontSize = isVeryLong
    ? "text-sm sm:text-base font-bold tracking-tighter"
    : isLong
      ? "text-base sm:text-lg lg:text-xl xl:text-base 2xl:text-lg font-extrabold tracking-tighter"
      : "text-lg sm:text-2xl font-extrabold tracking-tight";

  return (
    <div className={`p-4 sm:p-5 xl:p-4 2xl:p-5 rounded-2xl border bg-card text-card-foreground flex flex-col justify-between shadow-xs ${borderColors[tone]} ${glowEffects[tone]} transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`${valueFontSize} text-foreground`}>{value}</p>
      </div>

      <div className="flex items-center gap-1.5 mt-4 pt-2 border-t border-border/40 flex-wrap">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
            isPositive 
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
          }`}
        >
          {trendText} {isPositive ? "↗" : "↘"}
        </span>
        <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[110px]" title={subtext}>{subtext}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Sem dados para os filtros atuais.
    </div>
  );
}
