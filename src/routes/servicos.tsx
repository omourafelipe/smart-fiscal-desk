import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useFiscalStore } from "@/store/useFiscalStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";
import { Briefcase, Coins, Layers, TrendingUp, HelpCircle, Database } from "lucide-react";
import { GlobalFilters } from "@/components/GlobalFilters";

export const Route = createFileRoute("/servicos")({
  component: ServicosPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const C = {
  blue: "#2563EB",
  teal: "#14B8A6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#10B981",
  rose: "#F43F5E",
  orange: "#F97316",
  pink: "#EC4899",
  muted: "#94A3B8",
};

const PALETA = [C.blue, C.teal, C.purple, C.green, C.orange, C.pink, C.amber];

function ServicosPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  const {
    mesFiltro,
    anoFiltro,
    empresaFiltro,
    statusFiltro,
    operacaoFiltro,
    clienteFiltro,
    municipioFiltro,
    codigoTributarioFiltro,
    categoriaFiltro,
    grupoFiltro,
  } = useFiscalStore();

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  // Apply global filters
  const filtrados = useMemo(() => {
    return (docs ?? []).filter((d) => {
      if (anoFiltro) {
        if (!d.data_competencia || d.data_competencia.slice(0, 4) !== anoFiltro) return false;
      }
      if (mesFiltro) {
        if (!d.data_competencia || d.data_competencia.split("-")[1] !== mesFiltro) return false;
      }
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;

      const isIntercompany = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIntercompany) return false;
      if (operacaoFiltro === "Externas" && isIntercompany) return false;

      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return false;
      if (municipioFiltro && d.municipio !== municipioFiltro) return false;
      if (categoriaFiltro && d.categoria !== categoriaFiltro) return false;
      if (grupoFiltro && d.grupo !== grupoFiltro) return false;

      if (codigoTributarioFiltro) {
        const code = d.item_lista_servico || d.codigo_servico;
        if (code !== codigoTributarioFiltro) return false;
      }

      return true;
    });
  }, [docs, anoFiltro, mesFiltro, empresaFiltro, statusFiltro, operacaoFiltro, clienteFiltro, municipioFiltro, categoriaFiltro, grupoFiltro, codigoTributarioFiltro, cnpjGrupoSet]);

  const activeDocs = useMemo(
    () => (statusFiltro === "todos" ? filtrados.filter((d) => d.status_manual === "Ativo") : filtrados),
    [filtrados, statusFiltro]
  );

  const totalBruto = useMemo(() => activeDocs.reduce((s, d) => s + d.valor_bruto, 0), [activeDocs]);

  // Group by Categoria (Donut)
  const faturamentoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const cat = d.categoria || "Pendente / Não Classificado";
      map[cat] = (map[cat] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        pct: totalBruto > 0 ? (value / totalBruto) * 100 : 0
      }))
      .sort((a,b) => b.value - a.value);
  }, [activeDocs, totalBruto]);

  // Group by Grupo Gerencial (Colunas)
  const faturamentoPorGrupo = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const g = d.grupo || "Sem Grupo Mapeado";
      map[g] = (map[g] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);
  }, [activeDocs]);

  // Group by Centro de Receita (Donut / Table)
  const faturamentoPorCentro = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const cr = d.centro_receita || "Sem Centro Vinculado";
      map[cr] = (map[cr] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [activeDocs]);

  // Group by Código Tributário (BarChart / Table)
  const faturamentoPorCodigo = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach((d) => {
      const code = d.item_lista_servico || d.codigo_servico || "Sem Código";
      map[code] = (map[code] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 15);
  }, [activeDocs]);

  // Net Revenue by Service (detailed breakdown table)
  const receitaLiquidaPorServico = useMemo(() => {
    const map: Record<string, { desc: string; code: string; bruto: number; taxes: number; liquido: number; count: number; cat?: string }> = {};
    activeDocs.forEach((d) => {
      const key = d.descricao_servico || "Sem Descrição";
      if (!map[key]) {
        map[key] = {
          desc: key,
          code: d.item_lista_servico || d.codigo_servico || "—",
          bruto: 0,
          taxes: 0,
          liquido: 0,
          count: 0,
          cat: d.categoria,
        };
      }
      map[key].bruto += d.valor_bruto;
      const taxes = d.valor_bruto - d.valor_liquido;
      map[key].taxes += taxes;
      map[key].liquido += d.valor_liquido;
      map[key].count += 1;
    });
    return Object.values(map).sort((a,b) => b.bruto - a.bruto);
  }, [activeDocs]);

  const kpis = useMemo(() => {
    const classificados = activeDocs.filter((d) => d.categoria).length;
    const pctCobertura = activeDocs.length > 0 ? (classificados / activeDocs.length) * 100 : 0;
    
    return {
      qtdNotas: activeDocs.length,
      pctCobertura,
    };
  }, [activeDocs]);

  const hasData = activeDocs.length > 0;

  return (
    <div className="p-6 bg-background space-y-6 max-w-[1440px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Dashboard de Serviços
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Composição do faturamento: explore o rendimento por Categoria, Grupo Operacional, Centro de Receita e Código de Serviço.
        </p>
      </div>

      {/* Global Filters */}
      <GlobalFilters />

      {!hasData ? (
        <Card className="border-border">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            Sem dados suficientes para carregar o Dashboard de Serviços. Importe NFS-e com classificação gerencial.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Receita Bruta Total</span>
                <div className="text-xl font-bold text-foreground font-mono">{fmtBRL(totalBruto)}</div>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Coins className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">NFS-e Processadas</span>
                <div className="text-xl font-bold text-foreground font-mono">{kpis.qtdNotas}</div>
              </div>
              <div className="p-3 bg-teal-500/10 rounded-xl">
                <TrendingUp className="h-5 w-5 text-teal-500" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Cobertura de Mapeamento</span>
                <div className="text-xl font-bold text-primary font-mono">{kpis.pctCobertura.toFixed(1)}%</div>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Row 1: Receita por Categoria & Receita por Grupo */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Categoria */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Categoria</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Participação no faturamento por classificação gerencial</p>
              </div>
              <div className="h-56 w-full mt-4 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={faturamentoPorCategoria}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {faturamentoPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto">
                {faturamentoPorCategoria.map((d, index) => (
                  <div key={d.name} className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded hover:bg-muted/50 transition-colors">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETA[index % PALETA.length] }} />
                      <span className="truncate text-muted-foreground">{d.name}</span>
                    </span>
                    <span className="font-semibold text-foreground shrink-0">{fmtPct(d.pct)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo (Colunas) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Grupo Operacional</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Segmentação por grupo sintetizado mapeado em regras</p>
              </div>
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturamentoPorGrupo} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={fmtBRL} />
                    <Bar dataKey="value" name="Faturamento Bruto" fill={C.blue} radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Centro de Receita & Código Tributário */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Centro de Receita (Donut) */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Centro de Receita</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição do faturamento por centro de custo/receita</p>
              </div>
              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={faturamentoPorCentro}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {faturamentoPorCentro.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETA[(index + 3) % PALETA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Código Tributário (BarChart) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Código Tributário</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Top códigos nacionais (LC 116) / municipais emitidos</p>
              </div>
              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturamentoPorCodigo} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={fmtBRL} />
                    <Bar dataKey="value" name="Faturamento" fill={C.purple} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Tabela Detalhada de Receita Líquida por Serviço */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Database className="h-4 w-4 text-muted-foreground" />
                Receita Líquida por Serviço Específico
              </CardTitle>
              <CardDescription>
                Relação analítica completa mostrando receita bruta, deduções/retenções tributárias e receita líquida gerada por descrição do serviço.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-xl border-t border-border">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Descrição do Serviço</TableHead>
                      <TableHead className="text-xs">Categoria Gerencial</TableHead>
                      <TableHead className="text-xs text-center">Faturamento (Bruto)</TableHead>
                      <TableHead className="text-xs text-center">Deduções Fiscais</TableHead>
                      <TableHead className="text-xs text-right">Faturamento (Líquido)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receitaLiquidaPorServico.slice(0, 50).map((srv, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{srv.code}</TableCell>
                        <TableCell className="text-xs font-medium max-w-[320px] truncate text-foreground" title={srv.desc}>{srv.desc}</TableCell>
                        <TableCell className="text-xs">
                          {srv.cat ? (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400">
                              {srv.cat}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono font-medium">{fmtBRL(srv.bruto)}</TableCell>
                        <TableCell className="text-xs text-center font-mono text-rose-600 font-medium">-{fmtBRL(srv.taxes)}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-emerald-600 font-bold">{fmtBRL(srv.liquido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
