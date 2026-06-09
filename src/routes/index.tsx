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
  TrendingUp, Receipt, Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { db, type NotaFiscal } from "@/lib/db";
import { parseNfseXml } from "@/lib/parseXml";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function Dashboard() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

    for (const file of arr) {
      try {
        const zip = await JSZip.loadAsync(file);
        const xmlEntries = Object.values(zip.files).filter(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".xml"),
        );
        setProgress({ done: 0, total: xmlEntries.length });
        for (let i = 0; i < xmlEntries.length; i++) {
          const entry = xmlEntries[i];
          const xml = await entry.async("string");
          const nota = parseNfseXml(xml);
          if (nota) allNotas.push(nota);
          else skipped++;
          if (i % 25 === 0) setProgress({ done: i + 1, total: xmlEntries.length });
        }
      } catch (e) {
        console.error(e);
        toast.error(`Erro ao processar ${file.name}`);
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
      (n.servico || "").replace(/"/g, '""'), n.valor.toFixed(2), n.status, n.cStat,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "")}"`).join(";"))
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
                      tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: any) => fmtBRL(Number(v))}
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
                    <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
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

        <p className="text-center text-xs text-muted-foreground py-4">
          🔒 Processamento 100% local — seus XMLs nunca saem do seu navegador.
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
