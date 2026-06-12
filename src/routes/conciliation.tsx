import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import {
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Check,
  XCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { db, type NotaFiscal, type NotaFiscalTomada } from "@/lib/db";
import {
  parseExcelFile,
  detectColumns,
  parseExcelStatus,
  parseExcelIssRetido,
  type ExcelRowData,
} from "@/lib/xlsx-parser";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useTenantStore } from "@/store/useTenantStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/conciliation")({
  validateSearch: searchSchema,
  component: ConciliationRouteComponent,
});

function ConciliationRouteComponent() {
  const { addActivity } = useLayoutShell();
  const { activeRole } = useTenantStore();

  // Excel Fechamento States
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
  const [conciliationTarget, setConciliationTarget] = useState<"emitidas" | "tomadas">("emitidas");

  // Fetch local data from Dexie
  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], [] as NotaFiscalTomada[]);

  const runConciliation = useCallback(
    async (
      rows: ExcelRowData[],
      kCol: string,
      sCol: string,
      iCol: string,
      localNotas: NotaFiscal[],
      localNotasTomadas: NotaFiscalTomada[],
      target: "emitidas" | "tomadas",
    ) => {
      setIsXlsxProcessing(true);
      const results: ConciliationResult[] = [];

      let updated = 0;
      let alreadyCorrect = 0;
      let notFound = 0;

      if (target === "emitidas") {
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
      } else {
        const localMap = new Map<string, NotaFiscalTomada>();
        localNotasTomadas.forEach((n) => {
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

      const detected = detectColumns(headers);

      const kCol = detected.keyColumn ?? (headers.length > 0 ? headers[0] : "");
      const sCol = detected.statusColumn ?? (headers.length > 5 ? headers[5] : headers.length > 1 ? headers[1] : "");
      const issColDefault = detected.issColumn ?? (headers.length > 6 ? headers[6] : "");
      setKeyCol(kCol);
      setStatusCol(sCol);
      setIssCol(issColDefault);

      if (kCol && sCol && todasNotas && todasNotasTomadas) {
        runConciliation(rows, kCol, sCol, issColDefault, todasNotas, todasNotasTomadas, conciliationTarget);
      }
      addActivity("conciliation", "Planilha Carregada", `Relatório "${file.name}" carregado com ${rows.length} linhas.`);
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
      if (conciliationTarget === "emitidas") {
        await db.transaction("rw", db.notas, async () => {
          for (const item of changes) {
            if (item.notaId) {
              const updates: Partial<NotaFiscal> = {};
              if (item.statusChanged) updates.status = item.statusExcel;
              if (item.issRetidoChanged && item.issRetidoExcel) {
                updates.issRetido = item.issRetidoExcel;
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
      } else {
        await db.transaction("rw", db.notasTomadas, async () => {
          for (const item of changes) {
            if (item.notaId) {
              const updates: Partial<NotaFiscalTomada> = {};
              if (item.statusChanged) updates.status = item.statusExcel;
              if (item.issRetidoChanged && item.issRetidoExcel) {
                updates.issRetido = item.issRetidoExcel;
                const nota = todasNotasTomadas?.find((n) => n.id === item.notaId);
                const vlrIss = nota?.vlrIss ?? nota?.vlrIssRet ?? 0;
                if (item.issRetidoExcel === "Sim") {
                  updates.vlrIssRet = vlrIss;
                } else {
                  updates.vlrIssRet = 0;
                }
              }

              if (Object.keys(updates).length > 0) {
                await db.notasTomadas.update(item.notaId, updates);
              }
            }
          }
        });
      }
      addActivity("update", "Divergências Aplicadas", `${changes.length} nota(s) retificada(s) no banco local.`);
      toast.success("Divergências retificadas no banco de dados local!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar as updates.");
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
    if (xlsxRows.length > 0 && keyCol && statusCol && todasNotas && todasNotasTomadas) {
      runConciliation(xlsxRows, keyCol, statusCol, issCol, todasNotas, todasNotasTomadas, conciliationTarget);
    }
  }, [todasNotas, todasNotasTomadas, xlsxRows, keyCol, statusCol, issCol, conciliationTarget, runConciliation]);

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* Target Selector */}
      <div className="flex bg-muted p-1 rounded-xl border border-border/50 max-w-sm">
        <button
          onClick={() => {
            setConciliationTarget("emitidas");
            setXlsxFile(null);
            setXlsxRows([]);
            setXlsxHeaders([]);
            setConciliatedItems([]);
            setConciliatedStats({ total: 0, updated: 0, alreadyCorrect: 0, notFound: 0 });
            toast.info("Conciliador: Faturamento (Emitidas)");
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
            conciliationTarget === "emitidas"
              ? "bg-card text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Faturamento (Emitidas)
        </button>
        <button
          onClick={() => {
            setConciliationTarget("tomadas");
            setXlsxFile(null);
            setXlsxRows([]);
            setXlsxHeaders([]);
            setConciliatedItems([]);
            setConciliatedStats({ total: 0, updated: 0, alreadyCorrect: 0, notFound: 0 });
            toast.info("Conciliador: Serviços Tomados");
          }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
            conciliationTarget === "tomadas"
              ? "bg-card text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Serviços Tomados
        </button>
      </div>
      
      {/* XLSX DROP ZONE */}
      {activeRole === "Viewer" ? (
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl flex flex-col items-center gap-2 text-center shadow-xs">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="font-semibold text-xs text-foreground">Perfil de Acesso Limitado</p>
          <p className="text-[10px] text-muted-foreground max-w-md">
            Você está logado com o nível de acesso de <strong>Visualizador</strong>. 
            Não é possível carregar planilhas ou realizar a conciliação de faturamento/serviços.
          </p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setXlsxDragOver(true); }}
          onDragLeave={() => setXlsxDragOver(false)}
          onDrop={onXlsxDrop}
          onClick={() => !isXlsxProcessing && xlsxRef.current?.click()}
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
            disabled={isXlsxProcessing}
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
                    <p className="text-[10px] text-muted-foreground">Clique ou arraste outro arquivo para substituir</p>
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
      )}

      {/* CONCILIATION RESULT VIEW */}
      {xlsxRows.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-300">
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
                    <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
                      {xlsxHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Coluna Status / Situação</label>
                  <Select value={statusCol} onValueChange={(val) => setStatusCol(val)}>
                    <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
                      {xlsxHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Coluna ISS (Retido / a Recolher)</label>
                  <Select value={issCol} onValueChange={(val) => setIssCol(val)}>
                    <SelectTrigger className="w-full h-8 text-xs rounded-lg border-border bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
                      {xlsxHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Stats Dashboard Grid */}
            <div className="lg:col-span-8 grid grid-cols-2 gap-4">
              {/* Divergent Notes Card */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-colors duration-300">
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
              <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-colors duration-300">
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
              <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-colors duration-300">
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
              <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex items-center justify-between transition-colors duration-300">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Processado</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{conciliatedStats.total}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Linhas em processamento</p>
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
                {activeRole !== "Viewer" && (
                  <Button
                    size="sm"
                    onClick={applyUpdates}
                    disabled={conciliatedStats.updated === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs h-8 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Retificar Status no Banco
                  </Button>
                )}
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
    </main>
  );
}
