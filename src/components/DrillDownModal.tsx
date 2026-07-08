import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, Search, ArrowUpDown, ArrowUp, ArrowDown,
  FileText, Coins, TrendingUp, ShieldAlert,
} from "lucide-react";
import type { FiscalDocument } from "@/lib/db";
import type { DrillDownFilter } from "@/store/useFiscalStore";
import { exportToCsv } from "@/lib/export/exportCsv";
import { exportToExcel } from "@/lib/export/exportExcel";

/* ─── Helpers ─────────────────────────────────────────────────────── */

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

const fmtCompet = (v: string) => {
  if (!v) return "—";
  const [a, m] = v.split("-");
  return a && m ? `${m}/${a}` : v;
};

/** Extract a readable service label from a document */
function docServiceLabel(doc: FiscalDocument): string {
  const code = doc.item_lista_servico?.trim() || doc.codigo_servico?.trim() || "";
  const desc = doc.descricao_servico?.trim() || "";
  if (code && desc) return `${code} — ${desc.slice(0, 45)}`;
  if (code) return code;
  if (desc) return desc.slice(0, 50);
  return "—";
}

/** Returns the grouping key used in ServiceAnalysis */
function docServiceKey(doc: FiscalDocument): string {
  return (
    doc.item_lista_servico?.trim() ||
    doc.codigo_servico?.trim() ||
    (doc.descricao_servico?.trim()
      ? doc.descricao_servico.trim().slice(0, 40)
      : "") ||
    "Sem classificação"
  );
}

const PAGE_SIZE = 50;
/* Above this threshold, we switch to virtual scrolling instead of pagination */
const VIRTUAL_THRESHOLD = 500;

type SortKey =
  | "data_competencia"
  | "id_nota"
  | "prestador"
  | "tomador"
  | "servico"
  | "valor_bruto"
  | "valor_retido"
  | "valor_liquido"
  | "status_manual"
  | "intercompany";

type SortDir = "asc" | "desc";

/* ─── Props ───────────────────────────────────────────────────────── */

interface DrillDownModalProps {
  title: string;
  filter: DrillDownFilter;
  /** All docs already filtered by global filters */
  filteredDocs: FiscalDocument[];
  /** Set of CNPJs in the grupo (for intercompany detection) */
  cnpjGrupoSet: Set<string>;
  onClose: () => void;
}

/* ─── Component ───────────────────────────────────────────────────── */

export function DrillDownModal({
  title,
  filter,
  filteredDocs,
  cnpjGrupoSet,
  onClose,
}: DrillDownModalProps) {
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("data_competencia");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const parentRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Determine if a note is intercompany
  const isIntercompany = useCallback(
    (d: FiscalDocument) =>
      !!d.cnpj_prestador &&
      !!d.cnpj_tomador &&
      cnpjGrupoSet.has(d.cnpj_prestador) &&
      cnpjGrupoSet.has(d.cnpj_tomador),
    [cnpjGrupoSet]
  );

  // Apply drill-down specific filter on top of globally filtered docs
  const drillFiltered = useMemo(() => {
    return filteredDocs.filter((d) => {
      switch (filter.type) {
        case "all":
          return true;
        case "competencia": {
          if (!d.data_competencia) return false;
          const [a, m] = d.data_competencia.split("-");
          return `${m}/${a}` === filter.value;
        }
        case "prestador":
          return d.cnpj_prestador === filter.cnpj;
        case "intercompany":
          return isIntercompany(d);
        case "externo":
          return !isIntercompany(d);
        case "servico":
          return docServiceKey(d) === filter.serviceKey;
        case "cliente":
          return d.cnpj_tomador === filter.cnpj || (d.nome_tomador || d.cnpj_tomador) === filter.value;
        case "municipio":
          return d.municipio === filter.value;
        case "categoria_sintetica":
          return (d.categoria_sintetica || d.categoria) === filter.value;
        case "tributo": {
          if (filter.value === "ISS Retido") return (d.vlr_iss_ret || 0) > 0;
          if (filter.value === "IRRF") return (d.vlr_irrf || 0) > 0;
          if (filter.value === "CSLL") return (d.vlr_csll || 0) > 0;
          if (filter.value === "PIS") return (d.vlr_pis || 0) > 0;
          if (filter.value === "COFINS") return (d.vlr_cofins || 0) > 0;
          return d.valor_retido > 0;
        }
        default:
          return true;
      }
    });
  }, [filteredDocs, filter, isIntercompany]);

  // Text search
  const searched = useMemo(() => {
    if (!busca.trim()) return drillFiltered;
    const q = busca.trim().toLowerCase();
    return drillFiltered.filter(
      (d) =>
        d.id_nota.toLowerCase().includes(q) ||
        d.cnpj_prestador.includes(q) ||
        d.cnpj_tomador.includes(q) ||
        (d.nome_prestador || "").toLowerCase().includes(q) ||
        (d.nome_tomador || "").toLowerCase().includes(q) ||
        fmtCompet(d.data_competencia).includes(q) ||
        docServiceLabel(d).toLowerCase().includes(q)
    );
  }, [drillFiltered, busca]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...searched];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "data_competencia":
          cmp = (a.data_competencia || "").localeCompare(b.data_competencia || "");
          break;
        case "id_nota":
          cmp = a.id_nota.localeCompare(b.id_nota);
          break;
        case "prestador":
          cmp = (a.nome_prestador || a.cnpj_prestador || "").localeCompare(
            b.nome_prestador || b.cnpj_prestador || ""
          );
          break;
        case "tomador":
          cmp = (a.nome_tomador || a.cnpj_tomador || "").localeCompare(
            b.nome_tomador || b.cnpj_tomador || ""
          );
          break;
        case "servico":
          cmp = docServiceLabel(a).localeCompare(docServiceLabel(b));
          break;
        case "valor_bruto":
          cmp = a.valor_bruto - b.valor_bruto;
          break;
        case "valor_retido":
          cmp = a.valor_retido - b.valor_retido;
          break;
        case "valor_liquido":
          cmp = a.valor_liquido - b.valor_liquido;
          break;
        case "status_manual":
          cmp = a.status_manual.localeCompare(b.status_manual);
          break;
        case "intercompany":
          cmp = Number(isIntercompany(a)) - Number(isIntercompany(b));
          break;
      }
      return cmp * dir;
    });
    return arr;
  }, [searched, sortKey, sortDir, isIntercompany]);

  /* ── Virtual vs Paginated rendering ── */
  const useVirtual = sorted.length > VIRTUAL_THRESHOLD;

  // Pagination (only used when not virtual)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const slice = useVirtual ? sorted : sorted.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // TanStack Virtual
  const rowVirtualizer = useVirtualizer({
    count: useVirtual ? sorted.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  // Summary KPIs
  const summaryQty = searched.length;
  const summaryBruto = searched.reduce((s, d) => s + d.valor_bruto, 0);
  const summaryLiquido = searched.reduce((s, d) => s + d.valor_liquido, 0);
  const summaryRetido = searched.reduce((s, d) => s + d.valor_retido, 0);

  // Sort toggle
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-primary" />
    );
  };

  return (
    <div className="drilldown-backdrop" onClick={onClose}>
      <div
        className="drilldown-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detalhamento das notas que compõem este indicador
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              <FileText className="h-3 w-3" /> Notas
            </div>
            <div className="text-lg font-semibold mt-1">{summaryQty.toLocaleString("pt-BR")}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              <TrendingUp className="h-3 w-3" /> Valor Bruto
            </div>
            <div className="text-lg font-semibold mt-1">{fmtBRL(summaryBruto)}</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              <TrendingUp className="h-3 w-3" /> Valor Líquido
            </div>
            <div className="text-lg font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
              {fmtBRL(summaryLiquido)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              <Coins className="h-3 w-3" /> Retenções
            </div>
            <div className="text-lg font-semibold mt-1 text-rose-600 dark:text-rose-400">
              {fmtBRL(summaryRetido)}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 px-6 py-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, CNPJ, nome ou serviço..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {searched.length} nota(s)
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportToCsv({
                  docs: sorted,
                  cnpjGrupoSet,
                  filters: {
                    periodo: title,
                    empresa: "Drilldown",
                    status: "Ativo",
                    operacao: "Todas",
                  }
                });
              }}
              className="h-9 gap-1 text-xs"
            >
              Exportar CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                exportToExcel({
                  docs: sorted,
                  cnpjGrupoSet,
                  filters: {
                    periodo: title,
                    empresa: "Drilldown",
                    status: "Ativo",
                    operacao: "Todas",
                  }
                }, {
                  bruto: summaryBruto,
                  liquido: summaryLiquido,
                  retido: summaryRetido,
                  intercompany: sorted.filter(isIntercompany).reduce((s, d) => s + d.valor_bruto, 0),
                  qtd: summaryQty,
                  ticketMedio: summaryQty > 0 ? summaryBruto / summaryQty : 0
                });
              }}
              className="h-9 gap-1 text-xs"
            >
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Table */}
        <div ref={parentRef} className="flex-1 overflow-auto px-6 pb-2">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Column headers always visible */}
            <Table>
              <TableHeader>
                <TableRow>
                  {([
                    ["data_competencia", "Competência"],
                    ["id_nota", "ID da Nota"],
                    ["prestador", "Prestador"],
                    ["tomador", "Tomador"],
                    ["servico", "Serviço"],
                    ["valor_bruto", "Valor Bruto"],
                    ["valor_retido", "Retenções"],
                    ["valor_liquido", "Valor Líquido"],
                    ["status_manual", "Status"],
                    ["intercompany", "Intercompany"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <TableHead
                      key={key}
                      className={`cursor-pointer select-none hover:text-foreground transition-colors ${
                        ["valor_bruto", "valor_retido", "valor_liquido"].includes(key) ? "text-right" : ""
                      } ${["status_manual", "intercompany"].includes(key) ? "text-center" : ""}`}
                      onClick={() => handleSort(key)}
                    >
                      <span className="inline-flex items-center">
                        {label}
                        <SortIcon col={key} />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              {useVirtual ? (
                /* ── VIRTUAL MODE: only render visible rows ── */
                <TableBody>
                  <tr style={{ height: rowVirtualizer.getTotalSize(), position: "relative", display: "block" }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const d = sorted[virtualRow.index];
                      const ic = isIntercompany(d);
                      const svcLabel = docServiceLabel(d);
                      return (
                        <TableRow
                          key={d.id_nota}
                          className="group absolute w-full"
                          style={{ top: virtualRow.start, height: virtualRow.size }}
                        >
                          <TableCell className="text-xs font-mono">{fmtCompet(d.data_competencia)}</TableCell>
                          <TableCell className="text-xs font-mono max-w-[140px] truncate" title={d.id_nota}>{d.id_nota}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium truncate max-w-[140px]" title={d.nome_prestador}>{d.nome_prestador || "—"}</div>
                            <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_prestador)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium truncate max-w-[140px]" title={d.nome_tomador}>{d.nome_tomador || "—"}</div>
                            <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_tomador)}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[160px]"><div className="truncate text-muted-foreground" title={svcLabel}>{svcLabel}</div></TableCell>
                          <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_bruto)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_retido)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_liquido)}</TableCell>
                          <TableCell className="text-center">
                            {d.status_manual === "Ativo" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-[10px]">Ativo</Badge>
                            ) : (
                              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-0 text-[10px]">Cancelado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {ic ? (
                              <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-0 text-[10px]">
                                <ShieldAlert className="h-3 w-3 mr-0.5" />Sim
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </tr>
                </TableBody>
              ) : (
                /* ── PAGINATED MODE: classic page-by-page ── */
                <TableBody>
                  {slice.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-12">
                        Nenhuma nota encontrada para este indicador.
                      </TableCell>
                    </TableRow>
                  )}
                  {slice.map((d) => {
                    const ic = isIntercompany(d);
                    const svcLabel = docServiceLabel(d);
                    return (
                      <TableRow key={d.id_nota} className="group">
                        <TableCell className="text-xs font-mono">{fmtCompet(d.data_competencia)}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[140px] truncate" title={d.id_nota}>{d.id_nota}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium truncate max-w-[140px]" title={d.nome_prestador}>{d.nome_prestador || "—"}</div>
                          <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_prestador)}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium truncate max-w-[140px]" title={d.nome_tomador}>{d.nome_tomador || "—"}</div>
                          <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_tomador)}</div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[160px]"><div className="truncate text-muted-foreground" title={svcLabel}>{svcLabel}</div></TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_bruto)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_retido)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_liquido)}</TableCell>
                        <TableCell className="text-center">
                          {d.status_manual === "Ativo" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-[10px]">Ativo</Badge>
                          ) : (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-0 text-[10px]">Cancelado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {ic ? (
                            <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-0 text-[10px]">
                              <ShieldAlert className="h-3 w-3 mr-0.5" />Sim
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              )}
            </Table>
          </div>
          {useVirtual && (
            <div className="mt-2 text-center text-[11px] text-muted-foreground">
              {sorted.length.toLocaleString("pt-BR")} notas — rolagem virtual ativa
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-border shrink-0">
            <span className="text-xs text-muted-foreground">
              Exibindo {((pageSafe - 1) * PAGE_SIZE) + 1}–{Math.min(pageSafe * PAGE_SIZE, sorted.length)} de {sorted.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pageSafe === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {pageSafe} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pageSafe === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
