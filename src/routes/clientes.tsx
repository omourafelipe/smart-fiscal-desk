import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { TomadorDocumentField } from "@/components/fiscal/TomadorDocumentField";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import { Users, FileCheck, Landmark, ShieldCheck, Database, UserCheck, Percent } from "lucide-react";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
};

const C = {
  blue: "#2563EB",
  teal: "#14B8A6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#10B981",
  rose: "#F43F5E",
};

function ClientesPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const [validatedDoc, setValidatedDoc] = useState<any>(null);

  // Filtra notas ativas
  const activeDocs = useMemo(() => {
    return (docs ?? []).filter((d) => d.status_manual === "Ativo");
  }, [docs]);

  // Segregação de faturamento por tipo de tomador (CPF vs CNPJ)
  const segregacaoReceita = useMemo(() => {
    let pfTotal = 0;
    let pfCount = 0;
    let pjTotal = 0;
    let pjCount = 0;

    const pfSet = new Set<string>();
    const pjSet = new Set<string>();

    activeDocs.forEach((d) => {
      const clean = (d.cnpj_tomador || "").replace(/\D/g, "");
      
      if (clean.length === 11) {
        pfTotal += d.valor_bruto;
        pfCount += 1;
        pfSet.add(clean);
      } else if (clean.length === 14) {
        pjTotal += d.valor_bruto;
        pjCount += 1;
        pjSet.add(clean);
      }
    });

    const total = pfTotal + pjTotal;
    const pfPct = total > 0 ? (pfTotal / total) * 100 : 0;
    const pjPct = total > 0 ? (pjTotal / total) * 100 : 0;

    return {
      pfTotal,
      pfCount,
      pfClientesQtd: pfSet.size,
      pfPct,
      pjTotal,
      pjCount,
      pjClientesQtd: pjSet.size,
      pjPct,
      total,
    };
  }, [activeDocs]);

  // Dados para gráficos de pizza
  const chartData = useMemo(() => {
    return [
      { name: "Pessoa Jurídica (CNPJ)", value: segregacaoReceita.pjTotal, color: C.blue },
      { name: "Pessoa Física (CPF)", value: segregacaoReceita.pfTotal, color: C.green },
    ];
  }, [segregacaoReceita]);

  // Lista única de Clientes Tomadores
  const listagemClientes = useMemo(() => {
    const map: Record<string, { doc: string; name: string; type: "CPF" | "CNPJ"; faturamento: number; notas: number }> = {};
    
    activeDocs.forEach((d) => {
      const doc = d.cnpj_tomador || "";
      const clean = doc.replace(/\D/g, "");
      if (!clean) return;

      const type = clean.length === 11 ? "CPF" : "CNPJ";
      const name = d.nome_tomador || "Cliente não identificado";

      if (!map[clean]) {
        map[clean] = {
          doc: clean,
          name,
          type,
          faturamento: 0,
          notas: 0,
        };
      }
      map[clean].faturamento += d.valor_bruto;
      map[clean].notas += 1;
    });

    return Object.values(map).sort((a, b) => b.faturamento - a.faturamento);
  }, [activeDocs]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Módulo de Clientes & Segregação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie e valide os documentos dos tomadores das notas fiscais e analise a divisão de faturamento (CPF vs CNPJ).
        </p>
      </div>

      {/* Estatísticas de Segregação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CNPJ Total */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider block">Receita Corporate (CNPJ)</span>
            <Landmark className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {fmtBRL(segregacaoReceita.pjTotal)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{segregacaoReceita.pjClientesQtd} clientes PJ</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{segregacaoReceita.pjPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* CPF Total */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider block">Receita Varejo (CPF)</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {fmtBRL(segregacaoReceita.pfTotal)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{segregacaoReceita.pfClientesQtd} clientes PF</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{segregacaoReceita.pfPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Média de faturamento */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider block">Clientes Únicos Totais</span>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {segregacaoReceita.pfClientesQtd + segregacaoReceita.pjClientesQtd}
          </div>
          <div className="text-[10px] text-muted-foreground block">
            Base cadastral ativa
          </div>
        </div>

        {/* Total Notas */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider block">Notas Faturadas</span>
            <Landmark className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {segregacaoReceita.pfCount + segregacaoReceita.pjCount}
          </div>
          <div className="text-[10px] text-muted-foreground block">
            Emitidas no período
          </div>
        </div>
      </div>

      {/* Grid Principal: Playground de Documento e Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Validador Playground */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                Validador Inteligente de Tomador (CPF/CNPJ)
              </CardTitle>
              <CardDescription>
                Digite um documento. O componente detectará o formato automaticamente, validará os dígitos e buscará dados cadastrais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TomadorDocumentField 
                onDocumentChange={(d) => setValidatedDoc(d)}
              />

              {validatedDoc && validatedDoc.raw && (
                <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs space-y-2">
                  <h6 className="font-semibold text-foreground">Estado Atual da Validação (Pai):</h6>
                  <pre className="p-2.5 bg-card border border-border rounded font-mono text-[10px] text-muted-foreground overflow-x-auto">
                    {JSON.stringify(validatedDoc, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Distribuição */}
        <div className="lg:col-span-6">
          <Card className="border-border shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-purple-500" />
                Segregação de Receita Acumulada
              </CardTitle>
              <CardDescription>
                Divisão percentual do faturamento total de acordo com a natureza do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex justify-center items-center">
              {activeDocs.length === 0 ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Sem dados suficientes para exibir gráficos.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista de Clientes Ativos */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Database className="h-4 w-4 text-muted-foreground" />
            Relação de Clientes Ativos (CPF / CNPJ)
          </CardTitle>
          <CardDescription>
            Lista de tomadores identificados na base local, agrupados por volume de faturamento bruto e quantidade de notas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-xl border-t border-border">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Documento</TableHead>
                  <TableHead className="text-xs">Nome do Tomador / Razão Social</TableHead>
                  <TableHead className="text-xs text-center">Tipo</TableHead>
                  <TableHead className="text-xs text-center">Notas Emitidas</TableHead>
                  <TableHead className="text-xs text-right">Faturamento Bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listagemClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-10">
                      Nenhum cliente registrado na base local. Importe notas fiscais para carregar os tomadores.
                    </TableCell>
                  </TableRow>
                ) : (
                  listagemClientes.map((cli, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{fmtCnpj(cli.doc)}</TableCell>
                      <TableCell className="text-xs font-medium text-foreground">{cli.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[9px] font-mono border ${
                          cli.type === "CNPJ" 
                            ? "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400"
                            : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                        }`}>
                          {cli.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center font-mono">{cli.notas}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium">{fmtBRL(cli.faturamento)}</TableCell>
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
