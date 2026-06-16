import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, clearAllFiscalData } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigPage,
});

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v;
};

function ConfigPage() {
  const cnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);
  const audits = useLiveQuery(
    () => db.audits.orderBy("data_hora").reverse().limit(50).toArray(),
    []
  );

  const [novoCnpj, setNovoCnpj] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const adicionar = async () => {
    const clean = novoCnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos.");
      return;
    }
    const existing = await db.groupCnpjs.get(clean);
    if (existing) {
      toast.error("CNPJ já cadastrado.");
      return;
    }
    await db.groupCnpjs.put({
      cnpj: clean,
      nome: novoNome.trim() || undefined,
      criado_em: new Date().toISOString(),
    });
    setNovoCnpj("");
    setNovoNome("");
    toast.success("CNPJ adicionado ao grupo. Dashboard será recalculado.");
  };

  const remover = async (cnpj: string) => {
    await db.groupCnpjs.delete(cnpj);
    toast.success("CNPJ removido. Dashboard será recalculado.");
  };

  const resetData = async () => {
    await clearAllFiscalData();
    setShowConfirmReset(false);
    toast.success("Todas as notas e auditorias foram apagadas.");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os CNPJs do Grupo Empresarial. Notas com prestador e tomador no grupo são classificadas como Intercompany.
        </p>
      </div>

      {/* CRUD CNPJs */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">CNPJs do Grupo</h2>
          <Badge variant="secondary" className="text-[10px]">{cnpjs?.length ?? 0}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] font-medium text-muted-foreground">CNPJ</label>
            <Input
              placeholder="00.000.000/0000-00"
              value={novoCnpj}
              onChange={(e) => setNovoCnpj(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-[11px] font-medium text-muted-foreground">Nome (opcional)</label>
            <Input
              placeholder="Razão social ou apelido"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
            />
          </div>
          <Button onClick={adicionar}>
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNPJ</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cnpjs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum CNPJ cadastrado. Adicione ao menos um para habilitar a classificação Intercompany.
                  </TableCell>
                </TableRow>
              )}
              {(cnpjs ?? []).map((c) => (
                <TableRow key={c.cnpj}>
                  <TableCell className="font-mono text-xs">{fmtCnpj(c.cnpj)}</TableCell>
                  <TableCell className="text-xs">{c.nome || "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => remover(c.cnpj)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Auditoria */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Histórico de Importações</h2>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="text-right">Encontrados</TableHead>
                <TableHead className="text-right">Importadas</TableHead>
                <TableHead className="text-right">Duplicadas</TableHead>
                <TableHead className="text-right">Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(audits ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhuma importação registrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {(audits ?? []).map((a) => (
                <>
                  <TableRow
                    key={a.id}
                    className={a.erros > 0 ? "cursor-pointer" : ""}
                    onClick={() => a.erros > 0 && setExpanded(expanded === a.id ? null : (a.id ?? null))}
                  >
                    <TableCell className="text-xs font-mono">
                      {new Date(a.data_hora).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={a.arquivo}>
                      {a.arquivo}
                    </TableCell>
                    <TableCell className="text-right text-xs">{a.xmls_encontrados}</TableCell>
                    <TableCell className="text-right text-xs text-emerald-600">{a.importadas}</TableCell>
                    <TableCell className="text-right text-xs text-amber-600">{a.duplicadas}</TableCell>
                    <TableCell className="text-right text-xs text-rose-600">
                      {a.erros > 0 ? `${a.erros} ▾` : a.erros}
                    </TableCell>
                  </TableRow>
                  {expanded === a.id && a.detalhes_erros.length > 0 && (
                    <TableRow key={`${a.id}-detail`}>
                      <TableCell colSpan={6} className="bg-muted/40 p-3">
                        <div className="text-[11px] font-medium text-muted-foreground mb-2">
                          Detalhes dos erros:
                        </div>
                        <ul className="space-y-1 text-xs">
                          {a.detalhes_erros.map((e, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="font-mono text-rose-600">→</span>
                              <span className="font-mono">{e.arquivo}</span>
                              <span className="text-muted-foreground">— {e.motivo}</span>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Reset */}
      <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h2 className="font-semibold text-sm text-rose-700 dark:text-rose-300">Zona perigosa</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Apaga todas as notas importadas e o histórico de auditoria. CNPJs do grupo são mantidos.
        </p>
        {!showConfirmReset ? (
          <Button variant="destructive" size="sm" onClick={() => setShowConfirmReset(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Apagar todas as notas
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={resetData}>
              Confirmar exclusão
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowConfirmReset(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
