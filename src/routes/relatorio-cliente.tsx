import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FiscalDocument } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, SlidersHorizontal, Download, X, TrendingUp, Calendar,
  Users, DollarSign, FileText, ArrowUpDown, ChevronRight, Calculator,
  MapPin, ShieldAlert, Sparkles, ReceiptCent, Info, BarChart3, Clock
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Cell
} from "recharts";

export const Route = createFileRoute("/relatorio-cliente")({
  component: RelatorioClientePage,
});

/* ─── Helpers & Formatters ───────────────────────────────────────── */
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

const NOME_MES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
};

const parseCompetenceLabel = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-");
  const mes = NOME_MES[m] || m;
  return `${mes}/${y.slice(2)}`;
};

interface ClientRow {
  cnpj: string;
  nome: string;
  qtd: number;
  primeiroFaturamento: string;
  ultimoFaturamento: string;
  mesesFaturados: string[]; // Formatados: "Jan/26"
  valorBruto: number;
  valorRetido: number;
  valorLiquido: number;
  ticketMedio: number;
  participacao: number;
  rawNotes: FiscalDocument[];
}

function RelatorioClientePage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  /* ─── State ─────────────────────────────────────────────────────── */
  const [busca, setBusca] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Filtros Avançados
  const [filterEmpresa, setFilterEmpresa] = useState("todos");
  const [filterCompetenciaAno, setFilterCompetenciaAno] = useState("todos");
  const [filterCompetenciaMes, setFilterCompetenciaMes] = useState("todos");
  const [filterEmissaoAno, setFilterEmissaoAno] = useState("todos");
  const [filterEmissaoMes, setFilterEmissaoMes] = useState("todos");
  const [filterMunicipio, setFilterMunicipio] = useState("todos");
  const [filterTipoServico, setFilterTipoServico] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterRetencao, setFilterRetencao] = useState("todos"); // "todos", "com", "sem"
  const [filterValorMin, setFilterValorMin] = useState("");
  const [filterValorMax, setFilterValorMax] = useState("");
  const [filterQtdMinNfs, setFilterQtdMinNfs] = useState("");

  // Tabela Ordenação & Paginação
  const [sortKey, setSortKey] = useState<keyof ClientRow>("valorBruto");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Cliente Selecionado (Drawer)
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<string>("resumo");

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  /* ─── Extract Options for Filter Dropdowns ──────────────────────── */
  const filterOptions = useMemo(() => {
    const list = docs ?? [];
    const empresasMap = new Map<string, string>(); // cnpj -> nome
    const anosCompet = new Set<string>();
    const mesesCompet = new Set<string>();
    const anosEmissao = new Set<string>();
    const mesesEmissao = new Set<string>();
    const municipios = new Set<string>();
    const tiposServico = new Set<string>();
    const categorias = new Set<string>();

    list.forEach((d) => {
      if (d.cnpj_prestador) empresasMap.set(d.cnpj_prestador, d.empresa_nome || d.cnpj_prestador);
      
      if (d.data_competencia) {
        const [y, m] = d.data_competencia.split("-");
        if (y) anosCompet.add(y);
        if (m) mesesCompet.add(m);
      }
      if (d.data_emissao) {
        const [y, m] = d.data_emissao.split("-");
        if (y) anosEmissao.add(y);
        if (m) mesesEmissao.add(m);
      }
      if (d.municipio) municipios.add(d.municipio);
      
      const docType = d.tipo_servico || d.grupo;
      if (docType) tiposServico.add(docType);

      const docCat = d.categoria_sintetica || d.categoria;
      if (docCat) categorias.add(docCat);
    });

    return {
      empresas: Array.from(empresasMap.entries()).map(([cnpj, nome]) => ({ value: cnpj, label: nome })),
      anosCompet: Array.from(anosCompet).sort().reverse(),
      mesesCompet: Array.from(mesesCompet).sort(),
      anosEmissao: Array.from(anosEmissao).sort().reverse(),
      mesesEmissao: Array.from(mesesEmissao).sort(),
      municipios: Array.from(municipios).sort(),
      tiposServico: Array.from(tiposServico).sort(),
      categorias: Array.from(categorias).sort(),
    };
  }, [docs]);

  /* ─── Filter & Aggregate Documents ──────────────────────────────── */
  const aggregatedClients = useMemo(() => {
    if (!docs) return [];

    // 1. Filtrar as notas individualmente
    let filteredNotes = docs.filter((d) => d.status_manual === "Ativo");

    if (filterEmpresa !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.cnpj_prestador === filterEmpresa);
    }
    if (filterCompetenciaAno !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.data_competencia?.slice(0, 4) === filterCompetenciaAno);
    }
    if (filterCompetenciaMes !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.data_competencia?.split("-")[1] === filterCompetenciaMes);
    }
    if (filterEmissaoAno !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.data_emissao?.slice(0, 4) === filterEmissaoAno);
    }
    if (filterEmissaoMes !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.data_emissao?.split("-")[1] === filterEmissaoMes);
    }
    if (filterMunicipio !== "todos") {
      filteredNotes = filteredNotes.filter((d) => d.municipio === filterMunicipio);
    }
    if (filterTipoServico !== "todos") {
      filteredNotes = filteredNotes.filter((d) => (d.tipo_servico || d.grupo) === filterTipoServico);
    }
    if (filterCategoria !== "todos") {
      filteredNotes = filteredNotes.filter((d) => (d.categoria_sintetica || d.categoria) === filterCategoria);
    }
    if (filterRetencao === "com") {
      filteredNotes = filteredNotes.filter((d) => (d.valor_retido || 0) > 0);
    }
    if (filterRetencao === "sem") {
      filteredNotes = filteredNotes.filter((d) => (d.valor_retido || 0) === 0);
    }
    if (filterValorMin) {
      const minVal = parseFloat(filterValorMin);
      if (!isNaN(minVal)) {
        filteredNotes = filteredNotes.filter((d) => d.valor_bruto >= minVal);
      }
    }
    if (filterValorMax) {
      const maxVal = parseFloat(filterValorMax);
      if (!isNaN(maxVal)) {
        filteredNotes = filteredNotes.filter((d) => d.valor_bruto <= maxVal);
      }
    }

    // 2. Agrupar por Cliente (Tomador)
    const map = new Map<string, FiscalDocument[]>();
    filteredNotes.forEach((d) => {
      const key = d.cnpj_tomador || d.nome_tomador || "00000000000000";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });

    // 3. Consolidar Linhas do Relatório
    let rows: ClientRow[] = [];
    let totalFaturamentoGeral = 0;

    map.forEach((notes, cnpjKey) => {
      const valorBruto = notes.reduce((s, n) => s + (n.valor_bruto || 0), 0);
      const valorRetido = notes.reduce((s, n) => s + (n.valor_retido || 0), 0);
      const valorLiquido = notes.reduce((s, n) => s + (n.valor_liquido || 0), 0);
      const firstNote = notes[0];
      const nome = firstNote.nome_tomador || "Tomador não identificado";

      // Meses faturados distintos e cronológicos
      const mesesSet = new Set<string>();
      notes.forEach((n) => {
        if (n.data_competencia) {
          mesesSet.add(n.data_competencia.slice(0, 7)); // YYYY-MM
        }
      });
      const sortedMonths = Array.from(mesesSet)
        .sort()
        .map(parseCompetenceLabel);

      // Primeiro & Último Faturamento
      const datesCompet = notes.map((n) => n.data_competencia).filter(Boolean).sort();
      const primeiroFaturamento = datesCompet.length ? datesCompet[0].split("-").reverse().join("/") : "—";
      const ultimoFaturamento = datesCompet.length ? datesCompet[datesCompet.length - 1].split("-").reverse().join("/") : "—";

      totalFaturamentoGeral += valorBruto;

      rows.push({
        cnpj: cnpjKey,
        nome,
        qtd: notes.length,
        primeiroFaturamento,
        ultimoFaturamento,
        mesesFaturados: sortedMonths,
        valorBruto,
        valorRetido,
        valorLiquido,
        ticketMedio: notes.length > 0 ? valorBruto / notes.length : 0,
        participacao: 0, // calculado abaixo
        rawNotes: notes
      });
    });

    // Calcular participação percentual de cada cliente
    rows = rows.map((r) => ({
      ...r,
      participacao: totalFaturamentoGeral > 0 ? (r.valorBruto / totalFaturamentoGeral) * 100 : 0
    }));

    // 4. Aplicar busca em tempo real (Pesquisa Global)
    if (busca) {
      const q = busca.toLowerCase();
      rows = rows.filter((r) =>
        r.nome.toLowerCase().includes(q) ||
        r.cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    }

    // 5. Aplicar Filtro de Qtd Mínima de Notas
    if (filterQtdMinNfs) {
      const minNfs = parseInt(filterQtdMinNfs, 10);
      if (!isNaN(minNfs)) {
        rows = rows.filter((r) => r.qtd >= minNfs);
      }
    }

    return rows;
  }, [docs, busca, filterEmpresa, filterCompetenciaAno, filterCompetenciaMes, filterEmissaoAno, filterEmissaoMes, filterMunicipio, filterTipoServico, filterCategoria, filterRetencao, filterValorMin, filterValorMax, filterQtdMinNfs]);

  /* ─── Sorting Logic ────────────────────────────────────────────── */
  const sortedClients = useMemo(() => {
    return [...aggregatedClients].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // Handle Array (mesesFaturados) sorting by count
      if (sortKey === "mesesFaturados") {
        valA = a.mesesFaturados.length;
        valB = b.mesesFaturados.length;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      const numA = Number(valA || 0);
      const numB = Number(valB || 0);
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });
  }, [aggregatedClients, sortKey, sortOrder]);

  /* ─── Pagination ───────────────────────────────────────────────── */
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedClients.slice(start, start + pageSize);
  }, [sortedClients, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedClients.length / pageSize) || 1;

  const handleSort = (key: keyof ClientRow) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  /* ─── KPI Calculations ──────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const totalClientes = sortedClients.length;
    const valorTotal = sortedClients.reduce((s, c) => s + c.valorBruto, 0);
    const totalNfse = sortedClients.reduce((s, c) => s + c.qtd, 0);
    const ticketMedio = totalClientes > 0 ? valorTotal / totalClientes : 0;

    return {
      totalClientes,
      valorTotal,
      totalNfse,
      ticketMedio
    };
  }, [sortedClients]);

  /* ─── Export Functions ──────────────────────────────────────────── */
  const handleExportCsv = () => {
    if (!sortedClients.length) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const headers = [
      "CNPJ / CPF",
      "Razao Social",
      "Quantidade NFS-e",
      "Primeiro Faturamento",
      "Ultimo Faturamento",
      "Meses Faturados",
      "Valor Faturado (R$)",
      "Ticket Medio (R$)",
      "Participacao (%)"
    ];

    const lines = sortedClients.map((c) => [
      `"${fmtCnpj(c.cnpj)}"`,
      `"${c.nome.replace(/"/g, '""')}"`,
      c.qtd,
      c.primeiroFaturamento,
      c.ultimoFaturamento,
      `"${c.mesesFaturados.join(" · ")}"`,
      c.valorBruto.toFixed(2),
      c.ticketMedio.toFixed(2),
      c.participacao.toFixed(2)
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...lines.map((l) => l.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_faturamento_cliente_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportExcel = async () => {
    if (!sortedClients.length) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const excelData = sortedClients.map((c) => ({
        "CNPJ / CPF": fmtCnpj(c.cnpj),
        "Razão Social": c.nome,
        "Qtd NFS-e": c.qtd,
        "Primeiro Faturamento": c.primeiroFaturamento,
        "Último Faturamento": c.ultimoFaturamento,
        "Meses Faturados": c.mesesFaturados.join(" · "),
        "Valor Faturado (R$)": c.valorBruto,
        "Ticket Médio (R$)": c.ticketMedio,
        "Participação (%)": c.participacao / 100
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Formatar coluna monetária
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        // Coluna G: Valor Faturado (index 6)
        const cellVal = ws[XLSX.utils.encode_cell({ r: R, c: 6 })];
        if (cellVal) {
          cellVal.t = "n";
          cellVal.z = '"R$"#,##0.00';
        }
        // Coluna H: Ticket Médio (index 7)
        const cellTicket = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
        if (cellTicket) {
          cellTicket.t = "n";
          cellTicket.z = '"R$"#,##0.00';
        }
        // Coluna I: Participação (index 8)
        const cellPart = ws[XLSX.utils.encode_cell({ r: R, c: 8 })];
        if (cellPart) {
          cellPart.t = "n";
          cellPart.z = "0.00%";
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");
      XLSX.writeFile(wb, `relatorio_faturamento_cliente_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e?.message || "desconhecido"}`);
    }
  };

  const handleExportPdf = async () => {
    if (!sortedClients.length) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();

      // Top Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, W, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Relatório Analítico de Faturamento por Cliente", 15, 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}  ·  Consolidado do Grupo`, 15, 16);

      // KPIs Block
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(10, 26, W - 20, 16, 2, 2, "F");

      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text("TOTAL CLIENTES", 20, 31);
      doc.text("VALOR TOTAL FATURADO", 85, 31);
      doc.text("TOTAL NFS-E EMITIDAS", 160, 31);
      doc.text("TICKET MÉDIO / CLIENTE", 225, 31);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(kpis.totalClientes.toLocaleString("pt-BR"), 20, 37);
      doc.text(fmtBRL(kpis.valorTotal), 85, 37);
      doc.text(kpis.totalNfse.toLocaleString("pt-BR"), 160, 37);
      doc.text(fmtBRL(kpis.ticketMedio), 225, 37);

      // Table mapping
      const rows = sortedClients.slice(0, 1000).map((c) => [
        fmtCnpj(c.cnpj),
        c.nome.slice(0, 40),
        c.qtd,
        c.primeiroFaturamento,
        c.ultimoFaturamento,
        c.mesesFaturados.join(" · ").slice(0, 35),
        fmtBRL(c.valorBruto),
        fmtBRL(c.ticketMedio),
        `${c.participacao.toFixed(2)}%`
      ]);

      autoTable(doc, {
        startY: 46,
        head: [["CNPJ / CPF", "Cliente / Razão Social", "NFS-e", "1º Fat.", "Últ. Fat.", "Meses Ativo", "Total Faturado", "Ticket Médio", "Part."]],
        body: rows,
        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 64 },
          2: { cellWidth: 12, halign: "center" },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 16, halign: "center" },
          5: { cellWidth: 50 },
          6: { cellWidth: 28, halign: "right" },
          7: { cellWidth: 28, halign: "right" },
          8: { cellWidth: 15, halign: "center" }
        },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Página ${data.pageNumber}  ·  Exportação Limite: 1000 Clientes`,
            W / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: "center" }
          );
        }
      });

      doc.save(`relatorio_faturamento_cliente_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Relatório PDF gerado com sucesso!");
    } catch (e: any) {
      toast.error(`Falha ao gerar PDF: ${e?.message || "desconhecido"}`);
    }
  };

  /* ─── Client Details Calculations (Drawer) ─────────────────────── */
  const selectedClientData = useMemo(() => {
    if (!selectedClient) return null;
    const notes = selectedClient.rawNotes;

    // Monthly faturamento data
    const monthlyMap = new Map<string, { faturamento: number; retido: number; notas: number }>();
    notes.forEach((n) => {
      if (n.data_competencia) {
        const month = n.data_competencia.slice(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) monthlyMap.set(month, { faturamento: 0, retido: 0, notas: 0 });
        const obj = monthlyMap.get(month)!;
        obj.faturamento += n.valor_bruto || 0;
        obj.retido += n.valor_retido || 0;
        obj.notas += 1;
      }
    });

    const monthlyChart = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        name: parseCompetenceLabel(month),
        faturamento: data.faturamento,
        retido: data.retido,
        notas: data.notas
      }));

    // Category breakdown
    const catMap = new Map<string, number>();
    notes.forEach((n) => {
      const cat = n.categoria_sintetica || n.categoria || "Outros Serviços";
      catMap.set(cat, (catMap.get(cat) || 0) + n.valor_bruto);
    });

    const catChart = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // Taxes
    const taxes = {
      iss: notes.reduce((s, n) => s + (n.vlr_iss_ret || 0), 0),
      irrf: notes.reduce((s, n) => s + (n.vlr_irrf || 0), 0),
      csll: notes.reduce((s, n) => s + (n.vlr_csll || 0), 0),
      pis: notes.reduce((s, n) => s + (n.vlr_pis || 0), 0),
      cofins: notes.reduce((s, n) => s + (n.vlr_cofins || 0), 0),
      totalRetido: notes.reduce((s, n) => s + (n.valor_retido || 0), 0),
    };

    // Timeline Milestones
    const milestones = [];
    const notesSorted = [...notes].sort((a, b) => (a.data_competencia || "").localeCompare(b.data_competencia || ""));
    if (notesSorted.length > 0) {
      const first = notesSorted[0];
      milestones.push({
        title: "Primeiro Faturamento",
        date: first.data_competencia?.split("-").reverse().join("/") || "",
        desc: `Parceria iniciada com emissão da nota nº ${first.id_nota} no valor de ${fmtBRL(first.valor_bruto)}.`
      });
    }

    const highest = [...notes].sort((a, b) => b.valor_bruto - a.valor_bruto)[0];
    if (highest) {
      milestones.push({
        title: "Maior Nota Emitida",
        date: highest.data_competencia?.split("-").reverse().join("/") || "",
        desc: `Recorde de faturamento com a nota nº ${highest.id_nota} no montante de ${fmtBRL(highest.valor_bruto)}.`
      });
    }

    if (notesSorted.length > 1) {
      const last = notesSorted[notesSorted.length - 1];
      milestones.push({
        title: "Atividade Mais Recente",
        date: last.data_competencia?.split("-").reverse().join("/") || "",
        desc: `Último serviço faturado no valor de ${fmtBRL(last.valor_bruto)} (Nota nº ${last.id_nota}).`
      });
    }

    return {
      monthlyChart,
      catChart,
      taxes,
      milestones,
      notes: notesSorted.reverse() // Do mais novo ao mais antigo
    };
  }, [selectedClient]);

  /* ─── Clear All Filters ────────────────────────────────────────── */
  const handleClearFilters = () => {
    setFilterEmpresa("todos");
    setFilterCompetenciaAno("todos");
    setFilterCompetenciaMes("todos");
    setFilterEmissaoAno("todos");
    setFilterEmissaoMes("todos");
    setFilterMunicipio("todos");
    setFilterTipoServico("todos");
    setFilterCategoria("todos");
    setFilterRetencao("todos");
    setFilterValorMin("");
    setFilterValorMax("");
    setFilterQtdMinNfs("");
    setBusca("");
    setCurrentPage(1);
    toast.success("Filtros limpos!");
  };

  return (
    <div className="space-y-6 p-6 pb-12 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Relatório de Faturamento por Cliente
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consolidado analítico de faturamento gerencial e tributário por tomador de serviço.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 gap-1.5 text-xs"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showFilters ? "Recolher Filtros" : "Mostrar Filtros"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-9 gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-9 gap-1 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </Button>

          <Button
            size="sm"
            onClick={handleExportPdf}
            className="h-9 gap-1 text-xs bg-primary hover:bg-primary/95 text-white"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Quick Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border bg-card/65 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Clientes Ativos</span>
              <span className="text-lg font-bold text-foreground mt-0.5 block">{kpis.totalClientes.toLocaleString("pt-BR")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card/65 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Valor Total Faturado</span>
              <span className="text-lg font-bold text-foreground mt-0.5 block">{fmtBRL(kpis.valorTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card/65 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total NFS-e</span>
              <span className="text-lg font-bold text-foreground mt-0.5 block">{kpis.totalNfse.toLocaleString("pt-BR")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card/65 backdrop-blur-md">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Ticket Médio / Cliente</span>
              <span className="text-lg font-bold text-foreground mt-0.5 block">{fmtBRL(kpis.ticketMedio)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tray */}
      {showFilters && (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Painel de Filtros Avançados
              </span>
              <button
                onClick={handleClearFilters}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                Limpar Todos os Filtros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Pesquisa Global */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Pesquisa Global (Nome / CNPJ / CPF)</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite a Razão Social, CNPJ ou CPF..."
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setCurrentPage(1); }}
                    className="pl-9 h-9 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Empresa (Prestador) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Empresa Prestadora</label>
                <select
                  value={filterEmpresa}
                  onChange={(e) => { setFilterEmpresa(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todas as Empresas</option>
                  {filterOptions.empresas.map((emp) => (
                    <option key={emp.value} value={emp.value}>{emp.label}</option>
                  ))}
                </select>
              </div>

              {/* Situação Retenção */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Situação de Retenção</label>
                <select
                  value={filterRetencao}
                  onChange={(e) => { setFilterRetencao(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Clientes</option>
                  <option value="com">Possui Imposto Retido</option>
                  <option value="sem">Sem Imposto Retido</option>
                </select>
              </div>

              {/* Competência (Ano) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Competência (Ano)</label>
                <select
                  value={filterCompetenciaAno}
                  onChange={(e) => { setFilterCompetenciaAno(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Anos</option>
                  {filterOptions.anosCompet.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Competência (Mês) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Competência (Mês)</label>
                <select
                  value={filterCompetenciaMes}
                  onChange={(e) => { setFilterCompetenciaMes(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Meses</option>
                  {filterOptions.mesesCompet.map((m) => (
                    <option key={m} value={m}>{NOME_MES[m] || m}</option>
                  ))}
                </select>
              </div>

              {/* Emissão (Ano) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Emissão (Ano)</label>
                <select
                  value={filterEmissaoAno}
                  onChange={(e) => { setFilterEmissaoAno(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Anos</option>
                  {filterOptions.anosEmissao.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Emissão (Mês) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Emissão (Mês)</label>
                <select
                  value={filterEmissaoMes}
                  onChange={(e) => { setFilterEmissaoMes(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Meses</option>
                  {filterOptions.mesesEmissao.map((m) => (
                    <option key={m} value={m}>{NOME_MES[m] || m}</option>
                  ))}
                </select>
              </div>

              {/* Município */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Município do Tomador</label>
                <select
                  value={filterMunicipio}
                  onChange={(e) => { setFilterMunicipio(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Municípios</option>
                  {filterOptions.municipios.map((mun) => (
                    <option key={mun} value={mun}>{mun}</option>
                  ))}
                </select>
              </div>

              {/* Categoria Sintética */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Categoria Sintética</label>
                <select
                  value={filterCategoria}
                  onChange={(e) => { setFilterCategoria(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todas as Categorias</option>
                  {filterOptions.categorias.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Serviço */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Tipo de Serviço</label>
                <select
                  value={filterTipoServico}
                  onChange={(e) => { setFilterTipoServico(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todos">Todos os Tipos</option>
                  {filterOptions.tiposServico.map((ts) => (
                    <option key={ts} value={ts}>{ts}</option>
                  ))}
                </select>
              </div>

              {/* Faixa de Valor NFS (Mín / Máx) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Faixa de Valor NFS (Mín / Máx)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Mín. (R$)"
                    type="number"
                    value={filterValorMin}
                    onChange={(e) => { setFilterValorMin(e.target.value); setCurrentPage(1); }}
                    className="h-9 text-xs"
                  />
                  <Input
                    placeholder="Máx. (R$)"
                    type="number"
                    value={filterValorMax}
                    onChange={(e) => { setFilterValorMax(e.target.value); setCurrentPage(1); }}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Qtd Mínima de Notas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Mínimo de Notas Faturadas</label>
                <Input
                  placeholder="Ex: 5"
                  type="number"
                  value={filterQtdMinNfs}
                  onChange={(e) => { setFilterQtdMinNfs(e.target.value); setCurrentPage(1); }}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analytical Table Section */}
      <Card className="border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border/60 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Consolidado Analítico por Tomador ({sortedClients.length} Clientes Localizados)
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Exibir</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-8 rounded border border-input bg-background px-2 py-0.5 text-xs"
            >
              {[25, 50, 100, 250, 500].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">por página</span>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          <Table className="min-w-[1200px]">
            <TableHeader className="bg-muted/40 sticky top-0 z-30">
              <TableRow>
                <TableHead className="w-[180px] font-bold text-[10px] uppercase text-muted-foreground">CNPJ / CPF</TableHead>
                <TableHead
                  onClick={() => handleSort("nome")}
                  className="w-[300px] font-bold text-[10px] uppercase text-muted-foreground cursor-pointer hover:bg-muted/60 sticky left-0 bg-background/95 backdrop-blur-sm z-30"
                >
                  <div className="flex items-center gap-1">
                    Cliente / Razão Social
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("qtd")}
                  className="w-[90px] font-bold text-[10px] uppercase text-muted-foreground text-center cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-center gap-1">
                    Qtd NFS-e
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("primeiroFaturamento")}
                  className="w-[120px] font-bold text-[10px] uppercase text-muted-foreground text-center cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-center gap-1">
                    1º Faturamento
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("ultimoFaturamento")}
                  className="w-[120px] font-bold text-[10px] uppercase text-muted-foreground text-center cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-center gap-1">
                    Último Faturamento
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("mesesFaturados")}
                  className="min-w-[200px] font-bold text-[10px] uppercase text-muted-foreground cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center gap-1">
                    Meses Faturados
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("valorBruto")}
                  className="w-[140px] font-bold text-[10px] uppercase text-muted-foreground text-right cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-end gap-1">
                    Valor Faturado
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("ticketMedio")}
                  className="w-[120px] font-bold text-[10px] uppercase text-muted-foreground text-right cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-end gap-1">
                    Ticket Médio
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => handleSort("participacao")}
                  className="w-[90px] font-bold text-[10px] uppercase text-muted-foreground text-center cursor-pointer hover:bg-muted/60"
                >
                  <div className="flex items-center justify-center gap-1">
                    Part. %
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <TableRow
                    key={client.cnpj}
                    onClick={() => { setSelectedClient(client); setDrawerTab("resumo"); }}
                    className="cursor-pointer hover:bg-muted/30 group transition-colors"
                  >
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtCnpj(client.cnpj)}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground text-xs sticky left-0 bg-background group-hover:bg-muted/10 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[260px]">{client.nome}</span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-primary transition-all shrink-0 ml-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium text-xs">
                      {client.qtd}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {client.primeiroFaturamento}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {client.ultimoFaturamento}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      <div className="flex flex-wrap gap-1">
                        {client.mesesFaturados.slice(0, 4).map((m, idx) => (
                          <Badge key={idx} variant="secondary" className="px-1 py-0.5 text-[9px] font-mono">
                            {m}
                          </Badge>
                        ))}
                        {client.mesesFaturados.length > 4 && (
                          <Badge variant="outline" className="px-1 py-0.5 text-[9px] font-mono font-semibold">
                            +{client.mesesFaturados.length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                      {fmtBRL(client.valorBruto)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {fmtBRL(client.ticketMedio)}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold text-xs text-slate-600">
                      {client.participacao.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground italic text-xs">
                    Nenhum cliente faturado localizado para o recorte de filtros ativo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer / Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Exibindo registros {Math.min(sortedClients.length, (currentPage - 1) * pageSize + 1)} a{" "}
              {Math.min(sortedClients.length, currentPage * pageSize)} de {sortedClients.length}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs"
              >
                Anterior
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                // Exibir apenas páginas próximas à atual
                if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) {
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 text-xs p-0 ${currentPage === pageNum ? "text-white bg-primary" : ""}`}
                    >
                      {pageNum}
                    </Button>
                  );
                } else if (pageNum === 2 || pageNum === totalPages - 1) {
                  return <span key={pageNum} className="px-1 text-slate-400">...</span>;
                }
                return null;
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 text-xs"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Drawer: Histórico e Visão 360 do Cliente */}
      {selectedClient && selectedClientData && (
        <div className="fixed inset-0 bg-black/50 z-50 transition-opacity flex justify-end">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setSelectedClient(null)} />

          {/* Drawer Content */}
          <div className="relative w-full max-w-2xl md:max-w-3xl bg-background h-full shadow-2xl overflow-y-auto flex flex-col p-6 border-l border-border animate-in slide-in-from-right duration-300">
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">
                  {fmtCnpj(selectedClient.cnpj)}
                </span>
                <h2 className="text-base font-bold text-foreground pr-8 mt-1">
                  {selectedClient.nome}
                </h2>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1 hover:bg-muted rounded-full transition-colors absolute right-4 top-4"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-2 my-4">
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-center">
                <span className="text-[8px] text-muted-foreground uppercase font-bold block">Valor Faturado</span>
                <span className="text-[11px] font-mono font-bold text-foreground mt-0.5 block">
                  {fmtBRL(selectedClient.valorBruto)}
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-center">
                <span className="text-[8px] text-muted-foreground uppercase font-bold block">Notas Fiscais</span>
                <span className="text-[11px] font-mono font-bold text-foreground mt-0.5 block">
                  {selectedClient.qtd}
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-center">
                <span className="text-[8px] text-muted-foreground uppercase font-bold block">Ticket Médio</span>
                <span className="text-[11px] font-mono font-bold text-foreground mt-0.5 block">
                  {fmtBRL(selectedClient.ticketMedio)}
                </span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border border-border text-center">
                <span className="text-[8px] text-muted-foreground uppercase font-bold block">Participação</span>
                <span className="text-[11px] font-mono font-bold text-foreground mt-0.5 block">
                  {selectedClient.participacao.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Content Tabs */}
            <Tabs value={drawerTab} onValueChange={setDrawerTab} className="flex-1 flex flex-col mt-2">
              <TabsList className="grid grid-cols-4 bg-muted/65 p-1 rounded-lg w-full shrink-0">
                <TabsTrigger value="resumo" className="text-[10px] font-semibold py-1">Resumo & Evolução</TabsTrigger>
                <TabsTrigger value="tributario" className="text-[10px] font-semibold py-1">Tributos</TabsTrigger>
                <TabsTrigger value="timeline" className="text-[10px] font-semibold py-1">Timeline</TabsTrigger>
                <TabsTrigger value="notas" className="text-[10px] font-semibold py-1">Notas ({selectedClient.qtd})</TabsTrigger>
              </TabsList>

              {/* Tab 1: Resumo & Gráficos de Evolução */}
              <TabsContent value="resumo" className="space-y-4 pt-4 flex-1">
                {/* Evolution Chart */}
                <div className="border border-border rounded-xl p-4 bg-card/50 shadow-sm space-y-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Histórico de Faturamento Mensal (Últimos 12 meses ativos)
                  </span>
                  <div className="h-48 w-full font-mono text-[9px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedClientData.monthlyChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => fmtBRLCompact(v)} />
                        <Tooltip
                          formatter={(value: any) => [fmtBRL(value), "Faturado"]}
                          labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                          contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <Line type="monotone" dataKey="faturamento" stroke="#2563eb" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Bar Chart */}
                <div className="border border-border rounded-xl p-4 bg-card/50 shadow-sm space-y-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    Faturamento por Categoria de Serviço
                  </span>
                  {selectedClientData.catChart.length > 0 ? (
                    <div className="h-44 w-full font-mono text-[9px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedClientData.catChart} layout="vertical" margin={{ top: 5, right: 10, left: 30, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => fmtBRLCompact(v)} />
                          <YAxis type="category" dataKey="name" stroke="#94a3b8" width={90} />
                          <Tooltip
                            formatter={(value: any) => [fmtBRL(value), "Faturado"]}
                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                          />
                          <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]}>
                            {selectedClientData.catChart.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "#7c3aed" : "#a78bfa"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground italic">Sem dados de categorias.</div>
                  )}
                </div>
              </TabsContent>

              {/* Tab 2: Tributação */}
              <TabsContent value="tributario" className="space-y-4 pt-4 flex-1">
                <div className="border border-border rounded-xl p-4 bg-card/50 shadow-sm space-y-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-rose-500" />
                    Demonstrativo de Tributos Retidos
                  </span>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "ISS Retido", val: selectedClientData.taxes.iss, color: "text-rose-500" },
                      { label: "IRRF", val: selectedClientData.taxes.irrf, color: "text-rose-500" },
                      { label: "CSLL", val: selectedClientData.taxes.csll, color: "text-rose-500" },
                      { label: "PIS", val: selectedClientData.taxes.pis, color: "text-rose-500" },
                      { label: "COFINS", val: selectedClientData.taxes.cofins, color: "text-rose-500" },
                      { label: "Total Retido", val: selectedClientData.taxes.totalRetido, color: "text-rose-600 font-bold bg-rose-500/5 border border-rose-500/10" }
                    ].map((t, idx) => (
                      <div key={idx} className="bg-muted/30 border border-border/40 p-3 rounded-lg flex flex-col justify-between">
                        <span className="text-[8px] text-muted-foreground uppercase font-bold block">{t.label}</span>
                        <span className={`text-xs font-mono font-semibold mt-1.5 block ${t.color}`}>
                          {fmtBRL(t.val)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Faturamento Bruto Consolidado:</span>
                      <span className="font-semibold text-foreground">{fmtBRL(selectedClient.valorBruto)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>(-) Retenções na Fonte Totais:</span>
                      <span className="font-semibold">-{fmtBRL(selectedClientData.taxes.totalRetido)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600 border-t border-dashed border-border pt-2 text-sm">
                      <span>Faturamento Líquido Final:</span>
                      <span>{fmtBRL(selectedClient.valorLiquido)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-500 pt-1 text-[10px]">
                      <span>Percentual de Retenção Médio:</span>
                      <span>
                        {selectedClient.valorBruto > 0
                          ? ((selectedClientData.taxes.totalRetido / selectedClient.valorBruto) * 100).toFixed(2)
                          : "0.00"}%
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Linha do Tempo (Milestones) */}
              <TabsContent value="timeline" className="pt-4 flex-1">
                <div className="border border-border rounded-xl p-5 bg-card/50 shadow-sm space-y-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Linha do Tempo Comercial & Relacionamento
                  </span>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                    {selectedClientData.milestones.map((m, idx) => (
                      <div key={idx} className="relative space-y-1">
                        {/* Dot Indicator */}
                        <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary shadow-sm flex items-center justify-center" />
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">{m.title}</span>
                          <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">
                            {m.date}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {m.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Tabela de Notas */}
              <TabsContent value="notas" className="pt-4 flex-1 flex flex-col overflow-hidden">
                <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col flex-1">
                  <div className="overflow-y-auto max-h-[360px]">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 z-20">
                        <TableRow>
                          <TableHead className="w-[100px] font-bold text-[9px] uppercase text-muted-foreground text-center">Competência</TableHead>
                          <TableHead className="w-[120px] font-bold text-[9px] uppercase text-muted-foreground">Nº Nota</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase text-muted-foreground text-right">Valor Bruto</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase text-muted-foreground text-right">Tributos</TableHead>
                          <TableHead className="font-bold text-[9px] uppercase text-muted-foreground text-right">Valor Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClientData.notes.map((n) => (
                          <TableRow key={n.id_nota} className="hover:bg-muted/20">
                            <TableCell className="text-center font-mono text-[10px] text-muted-foreground">
                              {n.data_competencia ? parseCompetenceLabel(n.data_competencia.slice(0, 7)) : "—"}
                            </TableCell>
                            <TableCell className="font-semibold text-[11px] text-slate-800">
                              {n.id_nota}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] font-medium">
                              {fmtBRL(n.valor_bruto)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-rose-500">
                              {fmtBRL(n.valor_retido || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-emerald-600 font-semibold">
                              {fmtBRL(n.valor_liquido)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
