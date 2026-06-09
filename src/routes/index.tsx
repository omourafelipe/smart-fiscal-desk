import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import JSZip from "jszip";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Upload, FileText, Trash2, Download, Building2, CheckCircle2, XCircle,
  TrendingUp, Receipt, Loader2, FileSpreadsheet, AlertTriangle, Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { db, type NotaFiscal } from "@/lib/db";
import { parseNfseXml } from "@/lib/parseXml";
import { parseExcelFile, detectColumns, mapExcelRows, type ExcelRowData } from "@/lib/xlsx-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard NFS-e Nacional | BI Fiscal Multiempresa" },
      { name: "description", content: "Analise faturamento fiscal de NFS-e Nacional (SPED v1.01) com dashboards multiempresa, 100% no navegador." },
      { property: "og:title", content: "Dashboard NFS-e Nacional" },
      { property: "og:description", content: "BI fiscal multiempresa client-side para NFS-e Nacional." },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#3b82f6"];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
}

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
  const [conciliatedItems, setConciliatedItems] = useState<ConciliationResult[]>([]);
  const [isXlsxProcessing, setIsXlsxProcessing] = useState(false);
  const [conciliatedStats, setConciliatedStats] = useState({
    total: 0,
    updated: 0,
    alreadyCorrect: 0,
    notFound: 0,
  });

  const [empresaFiltro, setEmpresaFiltro] = useState<string>("__all__");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("__all__");

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    todasNotas?.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [todasNotas]);

  const periodos = useMemo(() => {
    const set = new Set<string>();
    todasNotas?.forEach((n) => {
      if (n.dhEmi) {
        const d = n.dhEmi.slice(0, 7); // YYYY-MM
        if (d.length === 7) set.add(d);
      }
    });
    return Array.from(set).sort().reverse();
  }, [todasNotas]);

  const notasFiltradas = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter((n) => {
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      if (periodoFiltro !== "__all__" && n.dhEmi.slice(0, 7) !== periodoFiltro) return false;
      return true;
    });
  }, [todasNotas, empresaFiltro, periodoFiltro]);

  const notasAtivas = notasFiltradas.filter((n) => n.status === "ativa");
  const notasCanceladas = notasFiltradas.filter((n) => n.status === "cancelada");
  const faturamento = notasAtivas.reduce((sum, n) => sum + n.valor, 0);
  const ticketMedio = notasAtivas.length ? faturamento / notasAtivas.length : 0;

  // Bar chart: evolução mensal (ou diária se período específico)
  const barData = useMemo(() => {
    const byKey = new Map<string, number>();
    const useDay = periodoFiltro !== "__all__";
    notasAtivas.forEach((n) => {
      if (!n.dhEmi) return;
      const key = useDay ? n.dhEmi.slice(0, 10) : n.dhEmi.slice(0, 7);
      byKey.set(key, (byKey.get(key) ?? 0) + n.valor);
    });
    return Array.from(byKey.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: useDay
          ? format(parseISO(k), "dd/MM", { locale: ptBR })
          : format(parseISO(k + "-01"), "MMM/yy", { locale: ptBR }),
        valor: v,
      }));
  }, [notasAtivas, periodoFiltro]);

  // Pie chart
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    const isGlobal = empresaFiltro === "__all__";
    notasAtivas.forEach((n) => {
      const key = isGlobal ? (n.nomePrestador || n.cnpjPrestador) : (n.servico || "Sem descrição");
      map.set(key, (map.get(key) ?? 0) + n.valor);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [notasAtivas, empresaFiltro]);

  const pieTitle = empresaFiltro === "__all__" ? "Faturamento por Empresa" : "Top Serviços por Faturamento";

  // Pagination
  const paged = useMemo(() => {
    const sorted = [...notasFiltradas].sort((a, b) => (b.dhEmi || "").localeCompare(a.dhEmi || ""));
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [notasFiltradas, page]);
  const totalPages = Math.max(1, Math.ceil(notasFiltradas.length / pageSize));

  useEffect(() => { setPage(1); }, [empresaFiltro, periodoFiltro]);

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
    const headers = ["Numero", "CNPJ Prestador", "Prestador", "Data", "Cliente", "Servico", "Valor", "Status", "cStat"];
    const rows = notasFiltradas.map((n) => [
      n.nNFSe, n.cnpjPrestador, n.nomePrestador, n.dhEmi, n.cliente,
      n.servico, n.valor.toFixed(2), n.status, n.cStat,
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

  const runConciliation = useCallback(async (
    rows: ExcelRowData[],
    kCol: string,
    sCol: string,
    localNotas: NotaFiscal[]
  ) => {
    setIsXlsxProcessing(true);
    const mapped = mapExcelRows(rows, kCol, sCol);
    const results: ConciliationResult[] = [];
    
    let updated = 0;
    let alreadyCorrect = 0;
    let notFound = 0;

    // Create a fast map of normalized chave to local note
    const localMap = new Map<string, NotaFiscal>();
    localNotas.forEach(n => {
      if (n.chave) {
        localMap.set(n.chave, n);
      }
    });

    for (const item of mapped) {
      const local = localMap.get(item.key);
      const res: ConciliationResult = {
        rowNumber: item.rowNumber,
        rawKey: item.rawKey,
        normalizedKey: item.key,
        nNFSe: local?.nNFSe || "—",
        prestador: local?.nomePrestador || "—",
        rawStatus: item.rawStatus,
        statusExcel: item.status,
        statusLocal: local ? local.status : "nao_encontrado",
        statusChanged: local ? local.status !== item.status : false,
        notaId: local?.id,
      };

      if (!local) {
        notFound++;
      } else if (res.statusChanged) {
        updated++;
      } else {
        alreadyCorrect++;
      }

      results.push(res);
    }

    setConciliatedItems(results);
    setConciliatedStats({
      total: mapped.length,
      updated,
      alreadyCorrect,
      notFound,
    });
    setIsXlsxProcessing(false);
  }, []);

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

      if (kCol && sCol && todasNotas) {
        runConciliation(rows, kCol, sCol, todasNotas);
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
    const changes = conciliatedItems.filter(item => item.statusChanged && item.notaId);
    if (changes.length === 0) {
      toast.info("Nenhuma divergência de status encontrada para atualizar.");
      return;
    }

    try {
      await db.transaction("rw", db.notas, async () => {
        for (const item of changes) {
          if (item.notaId) {
            await db.notas.update(item.notaId, { status: item.statusExcel });
          }
        }
      });
      toast.success(`${changes.length} nota(s) atualizada(s) com sucesso no banco de dados local!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar as atualizações.");
    }
  };

  const exportValidationCsv = () => {
    const headers = ["Linha Planilha", "Chave de Acesso", "Chave Normalizada", "Nº NFS-e", "Prestador", "Status Planilha", "Status Local", "Divergente"];
    const rows = conciliatedItems.map(item => [
      item.rowNumber,
      item.rawKey,
      item.normalizedKey,
      item.nNFSe,
      item.prestador,
      item.statusExcel,
      item.statusLocal === "nao_encontrado" ? "Não Encontrado" : item.statusLocal,
      item.statusChanged ? "Sim" : "Não"
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
      runConciliation(xlsxRows, keyCol, statusCol, todasNotas);
    }
  }, [todasNotas, xlsxRows, keyCol, statusCol, runConciliation]);

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
                  <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os períodos</SelectItem>
                {periodos.map((p) => (
                  <SelectItem key={p} value={p}>
                    {format(parseISO(p + "-01"), "MMMM 'de' yyyy", { locale: ptBR })}
                  </SelectItem>
                ))}
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
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                    <p className="font-semibold">Arraste arquivos .zip aqui ou clique para selecionar</p>
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
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
                          tickFormatter={(v) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`}
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

              <Card>
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
            </div>

            {/* Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notas Fiscais ({notasFiltradas.length.toLocaleString("pt-BR")})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportCsv} disabled={!notasFiltradas.length}>
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearDb}>
                    <Trash2 className="h-4 w-4 mr-2" /> Limpar Base
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhuma nota encontrada. Envie um .zip para começar.
                          </TableCell>
                        </TableRow>
                      ) : paged.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs">{n.nNFSe}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {n.dhEmi ? format(parseISO(n.dhEmi), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate" title={n.nomePrestador}>
                            {n.nomePrestador}
                          </TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate" title={n.cliente}>
                            {n.cliente}
                          </TableCell>
                          <TableCell className="text-xs max-w-[240px] truncate" title={n.servico}>
                            {n.servico}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                            {fmtBRL(n.valor)}
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
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <span className="text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Próxima
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
              onDragOver={(e) => { e.preventDefault(); setXlsxDragOver(true); }}
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
                        <p className="text-xs text-muted-foreground">Clique ou arraste outro arquivo para substituir</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">Arraste a planilha de relatório (.xlsx) aqui ou clique para selecionar</p>
                        <p className="text-sm text-muted-foreground">
                          O arquivo Excel deve conter as colunas de "Chave de Acesso" e "Situação/Status"
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
                              <SelectItem key={h} value={h}>{h}</SelectItem>
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
                              <SelectItem key={h} value={h}>{h}</SelectItem>
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
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Divergentes / Atualizáveis</p>
                          <p className="text-3xl font-extrabold mt-2 text-indigo-600">{conciliatedStats.updated}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-indigo-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Já Conciliadas</p>
                          <p className="text-3xl font-extrabold mt-2 text-emerald-600">{conciliatedStats.alreadyCorrect}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Check className="h-5 w-5 text-emerald-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Não Encontradas localmente</p>
                          <p className="text-3xl font-extrabold mt-2 text-rose-500">{conciliatedStats.notFound}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                          <XCircle className="h-5 w-5 text-rose-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50/50">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Total Processado</p>
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
                            <TableHead>Status Planilha</TableHead>
                            <TableHead>Status Local</TableHead>
                            <TableHead>Resultado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conciliatedItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                Mapeie as colunas de Chave e Status acima para visualizar os dados.
                              </TableCell>
                            </TableRow>
                          ) : (
                            conciliatedItems.map((item, idx) => (
                              <TableRow key={idx} className={item.statusChanged ? "bg-amber-50/40 hover:bg-amber-50/60" : ""}>
                                <TableCell className="text-xs font-mono">{item.rowNumber}</TableCell>
                                <TableCell className="text-xs font-mono max-w-[220px] truncate" title={item.rawKey}>
                                  {item.rawKey}
                                </TableCell>
                                <TableCell className="text-xs font-mono">{item.nNFSe}</TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={item.prestador}>
                                  {item.prestador}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {item.statusExcel === "ativa" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                      Ativa
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                                      Cancelada
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <Badge variant="outline" className="text-slate-400 border-slate-200 bg-slate-50">
                                      Não Encontrado
                                    </Badge>
                                  ) : item.statusLocal === "ativa" ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                                      Ativa
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">
                                      Cancelada
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs font-semibold">
                                  {item.statusLocal === "nao_encontrado" ? (
                                    <span className="text-rose-500">Inexistente no Banco</span>
                                  ) : item.statusChanged ? (
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5" /> Divergente (Pronto para atualizar)
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
  label, value, icon, tone,
}: {
  label: string; value: string; icon: React.ReactNode;
  tone: "indigo" | "purple" | "emerald" | "rose";
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-2">{value}</p>
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
