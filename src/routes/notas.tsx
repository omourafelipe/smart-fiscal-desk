import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type StatusManual } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notas")({
  component: NotasPage,
});

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

const PAGE = 50;

function NotasPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);

  const semClassificacaoCount = useMemo(() => {
    return (docs ?? []).filter((d) => d.status_manual === "Ativo" && !d.categoria).length;
  }, [docs]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusManual>("todos");
  const [page, setPage] = useState(1);

  const lista = useMemo(() => {
    let l = docs ?? [];
    if (statusFiltro !== "todos") l = l.filter((d) => d.status_manual === statusFiltro);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      l = l.filter(
        (d) =>
          d.id_nota.toLowerCase().includes(q) ||
          d.cnpj_prestador.includes(q) ||
          d.cnpj_tomador.includes(q) ||
          (d.nome_prestador || "").toLowerCase().includes(q) ||
          (d.nome_tomador || "").toLowerCase().includes(q)
      );
    }
    return [...l].sort((a, b) => (b.data_competencia || "").localeCompare(a.data_competencia || ""));
  }, [docs, busca, statusFiltro]);

  const totalPages = Math.max(1, Math.ceil(lista.length / PAGE));
  const pageSafe = Math.min(page, totalPages);
  const slice = lista.slice((pageSafe - 1) * PAGE, pageSafe * PAGE);

  const toggleStatus = async (id_nota: string, current: StatusManual) => {
    const next: StatusManual = current === "Ativo" ? "Cancelado" : "Ativo";
    await db.documents.update(id_nota, { status_manual: next });
    toast.success(`Nota ${next === "Ativo" ? "reativada" : "marcada como cancelada"}.`);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notas Fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alterne o status manual entre <strong>Ativo</strong> e <strong>Cancelado</strong>. Notas canceladas saem dos KPIs.
        </p>
      </div>

      {semClassificacaoCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Notas sem Classificação Gerencial</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Existem <strong>{semClassificacaoCount}</strong> notas fiscais ativas sem classificação gerencial.
              </div>
            </div>
          </div>
          <Link
            to="/classificacao"
            className="inline-flex items-center justify-center rounded-md bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors"
          >
            Classificar Agora
          </Link>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, CNPJ ou nome..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 text-xs">
          {(["todos", "Ativo", "Cancelado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFiltro(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium border transition-colors ${
                statusFiltro === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "todos" ? "Todos" : s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {lista.length} nota(s)
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competência</TableHead>
              <TableHead>ID da Nota</TableHead>
              <TableHead>Prestador</TableHead>
              <TableHead>Tomador</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma nota encontrada. Importe XMLs no Dashboard.
                </TableCell>
              </TableRow>
            )}
            {slice.map((d) => (
              <TableRow key={d.id_nota}>
                <TableCell className="text-xs font-mono">{fmtCompet(d.data_competencia)}</TableCell>
                <TableCell className="text-xs font-mono max-w-[180px] truncate" title={d.id_nota}>
                  {d.id_nota}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium truncate max-w-[180px]" title={d.nome_prestador}>
                    {d.nome_prestador || "—"}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_prestador)}</div>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium truncate max-w-[180px]" title={d.nome_tomador}>
                    {d.nome_tomador || "—"}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_tomador)}</div>
                </TableCell>
                <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_bruto)}</TableCell>
                <TableCell className="text-right text-xs font-mono">{fmtBRL(d.valor_liquido)}</TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant={d.status_manual === "Ativo" ? "outline" : "secondary"}
                    onClick={() => toggleStatus(d.id_nota, d.status_manual)}
                    className="h-7 text-[11px]"
                  >
                    {d.status_manual === "Ativo" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">Ativo</Badge>
                    ) : (
                      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-0">Cancelado</Badge>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={pageSafe === 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">Página {pageSafe} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={pageSafe === totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
