import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ServiceTypeAutocomplete } from "@/components/fiscal/ServiceTypeAutocomplete";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import { Briefcase, Sparkles, Database, HelpCircle, Layers, Coins, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  component: ServicosPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const C = {
  blue: "#2563EB",
  teal: "#14B8A6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#10B981",
  orange: "#F97316",
  pink: "#EC4899",
  muted: "#94A3B8",
};

const PALETA = [C.blue, C.teal, C.purple, C.green, C.orange, C.pink, C.amber];

function ServicosPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const [selectedClassification, setSelectedClassification] = useState<any>(null);

  // Filtra notas ativas
  const activeDocs = useMemo(() => {
    return (docs ?? []).filter((d) => d.status_manual === "Ativo");
  }, [docs]);

  // Agrupa dados para gráficos
  const faturamentoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const cat = d.categoria || "Pendente / Não Classificado";
      map[cat] = (map[cat] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [activeDocs]);

  // Lista dos serviços únicos e sua receita correspondente
  const servicosUnicos = useMemo(() => {
    const map: Record<string, { code: string; desc: string; total: number; count: number; cat?: string }> = {};
    activeDocs.forEach((d) => {
      const key = d.codigo_servico || d.item_lista_servico || d.descricao_servico || "Sem identificação";
      if (!map[key]) {
        map[key] = {
          code: d.item_lista_servico || d.codigo_servico || "—",
          desc: d.descricao_servico || "Sem descrição",
          total: 0,
          count: 0,
          cat: d.categoria,
        };
      }
      map[key].total += d.valor_bruto;
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [activeDocs]);

  const kpis = useMemo(() => {
    const total = activeDocs.reduce((acc, d) => acc + d.valor_bruto, 0);
    const classificados = activeDocs.filter((d) => d.categoria).length;
    const pctCobertura = activeDocs.length > 0 ? (classificados / activeDocs.length) * 100 : 0;
    
    return {
      total,
      qtdNotas: activeDocs.length,
      pctCobertura,
    };
  }, [activeDocs]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Módulo de Serviços
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore as notas fiscais importadas e teste a classificação de serviços através do motor inteligente de priorização.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Faturamento Bruto Total</span>
            <div className="text-2xl font-bold text-foreground font-mono">{fmtBRL(kpis.total)}</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Coins className="h-5 w-5 text-blue-500" />
          </div>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Notas Processadas</span>
            <div className="text-2xl font-bold text-foreground font-mono">{kpis.qtdNotas}</div>
          </div>
          <div className="p-3 bg-teal-500/10 rounded-xl">
            <TrendingUp className="h-5 w-5 text-teal-500" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Cobertura de Classificação</span>
            <div className="text-2xl font-bold text-primary font-mono">{kpis.pctCobertura.toFixed(1)}%</div>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <Layers className="h-5 w-5 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Grid Principal: Playground e Regras */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Playground Autocomplete (IA) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Playground de Classificação Inteligente
              </CardTitle>
              <CardDescription>
                Simule como a API de Machine Learning classifica faturamentos fiscais a partir de descrições em texto livre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ServiceTypeAutocomplete 
                onSelectClassification={(c) => setSelectedClassification(c)}
              />
              
              {selectedClassification && (
                <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs space-y-2">
                  <h6 className="font-semibold text-foreground">Retorno do Callback de Seleção (Pai):</h6>
                  <pre className="p-2.5 bg-card border border-border rounded font-mono text-[10px] text-muted-foreground overflow-x-auto">
                    {JSON.stringify(selectedClassification, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Como funciona o Motor */}
        <div className="lg:col-span-5">
          <Card className="border-border shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-primary" />
                Hierarquia de Prioridades Tributárias
              </CardTitle>
              <CardDescription>
                O sistema de classificação fiscal consome dados do XML seguindo uma precedência lógica de maior relevância:
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-3.5">
              <div className="flex gap-3">
                <Badge className="bg-emerald-500/10 text-emerald-700 h-5 border-emerald-500/20 shrink-0 font-mono text-[10px]">1</Badge>
                <div>
                  <div className="font-semibold text-foreground">Tipo de Serviço (Muito Alta)</div>
                  <p className="text-muted-foreground mt-0.5">Campos explícitos do cabeçalho da NFS-e Nacional.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-emerald-500/10 text-emerald-700 h-5 border-emerald-500/20 shrink-0 font-mono text-[10px]">2</Badge>
                <div>
                  <div className="font-semibold text-foreground">Código Municipal (Alta)</div>
                  <p className="text-muted-foreground mt-0.5">Filtro baseado na tabela de serviços de cada prefeitura.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-emerald-500/10 text-emerald-700 h-5 border-emerald-500/20 shrink-0 font-mono text-[10px]">3</Badge>
                <div>
                  <div className="font-semibold text-foreground">LC 116/2003 (Alta)</div>
                  <p className="text-muted-foreground mt-0.5">Tabela padrão nacional de incidência do ISS.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-amber-500/10 text-amber-700 h-5 border-amber-500/20 shrink-0 font-mono text-[10px]">4</Badge>
                <div>
                  <div className="font-semibold text-foreground">Similaridade Textual (Média)</div>
                  <p className="text-muted-foreground mt-0.5">Processamento de Linguagem Natural (NLP) na descrição da nota.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-rose-500/10 text-rose-700 h-5 border-rose-500/20 shrink-0 font-mono text-[10px]">5</Badge>
                <div>
                  <div className="font-semibold text-foreground">Fallback Manual (Baixa)</div>
                  <p className="text-muted-foreground mt-0.5">Entradas genéricas enviadas para classificação manual gerencial.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficos de Análise e Lista de Serviços */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Distribuição por Categoria */}
        <Card className="lg:col-span-5 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Receita por Categoria de Serviço</CardTitle>
            <CardDescription>Visualização do faturamento bruto acumulado por classificação.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex justify-center items-center">
            {activeDocs.length === 0 ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Sem dados suficientes. Importe notas fiscais.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={faturamentoPorCategoria}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {faturamentoPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela de Serviços Mapeados */}
        <Card className="lg:col-span-7 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4 text-muted-foreground" />
              Serviços e Receita Acumulada
            </CardTitle>
            <CardDescription>Detalhamento de faturamento por serviço identificado nas NFS-e.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl border-t border-border">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Descrição do Serviço</TableHead>
                    <TableHead className="text-xs text-center">Notas</TableHead>
                    <TableHead className="text-xs text-right">Faturamento</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicosUnicos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                        Nenhum faturamento registrado na base local.
                      </TableCell>
                    </TableRow>
                  ) : (
                    servicosUnicos.slice(0, 10).map((srv, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{srv.code}</TableCell>
                        <TableCell className="text-xs truncate max-w-[200px]" title={srv.desc}>{srv.desc}</TableCell>
                        <TableCell className="text-xs text-center font-mono">{srv.count}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-medium">{fmtBRL(srv.total)}</TableCell>
                        <TableCell className="text-center">
                          {srv.cat ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-mono">
                              Mapeado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 hover:bg-amber-500/10 text-[9px] font-mono">
                              Pendente
                            </Badge>
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
    </div>
  );
}
