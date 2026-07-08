import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Building2, RefreshCw, Server, Plus, ArrowUpDown, Calendar } from "lucide-react";
import { toast } from "sonner";

import { db, type Empresa } from "@/lib/db";
import { sincronizarEmpresas } from "@/lib/fiscal/syncEmpresas";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/empresas")({
  component: EmpresasPage,
});

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function fmtCnpj(v: string) {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
}

function EmpresasPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const empresas = useLiveQuery(() => db.empresas.toArray(), []) || [];

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await sincronizarEmpresas();
      toast.success("Sincronização concluída", {
        description: `Processadas ${res.notasProcessadas} notas e atualizadas ${res.empresasProcessadas} empresas.`,
      });
    } catch (err: any) {
      toast.error("Erro na sincronização", {
        description: err.message || "Não foi possível sincronizar.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Empresas do Grupo
          </h2>
          <p className="text-muted-foreground mt-1">
            Gestão automática das empresas com base nos documentos fiscais importados.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Empresas"}
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            Cadastro de Empresas
          </CardTitle>
          <CardDescription>
            Estas empresas foram identificadas automaticamente como prestadoras/emitentes nas notas fiscais importadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Razão Social</TableHead>
                  <TableHead className="font-semibold text-foreground">CNPJ</TableHead>
                  <TableHead className="font-semibold text-foreground">Local</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Qtd Notas</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Faturamento</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Impostos (ISS/IRRF)</TableHead>
                  <TableHead className="font-semibold text-foreground">Última Importação</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      Nenhuma empresa identificada. Importe notas fiscais para preencher este cadastro.
                    </TableCell>
                  </TableRow>
                ) : (
                  empresas.map((emp) => (
                    <TableRow key={emp.cnpj} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        {emp.razao_social}
                        {!emp.ativo && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {fmtCnpj(emp.cnpj)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {emp.municipio || "—"}{emp.uf ? `/${emp.uf}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {emp.quantidade_notas}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {fmtBRL(emp.valor_total)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <div className="flex flex-col text-xs">
                          <span>ISS: {fmtBRL(emp.iss_total)}</span>
                          <span>IRRF: {fmtBRL(emp.irrf_total)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 opacity-70" />
                          {fmtData(emp.ultima_importacao)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {emp.origem_cadastro}
                        </Badge>
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
  );
}
