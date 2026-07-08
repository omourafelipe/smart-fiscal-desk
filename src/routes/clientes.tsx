import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useFiscalStore } from "@/store/useFiscalStore";
import { TomadorDocumentField } from "@/components/fiscal/TomadorDocumentField";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, ComposedChart, Line
} from "recharts";
import { Users, AlertTriangle, ShieldCheck, Database, Landmark, Percent, Settings, Sparkles } from "lucide-react";
import { GlobalFilters } from "@/components/GlobalFilters";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v || "—";
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

function ClientesPage() {
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

  const [validatedDoc, setValidatedDoc] = useState<any>(null);
  const [concentrationThreshold, setConcentrationThreshold] = useState<number>(20); // default 20%

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  const cnpjNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (grupoCnpjs ?? []).forEach((g) => {
      if (g.cnpj && g.nome) m[g.cnpj] = g.nome;
    });
    return m;
  }, [grupoCnpjs]);

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

  // Group by client and build ABC curve
  const clientABC = useMemo(() => {
    const map: Record<string, { name: string; doc: string; total: number; count: number }> = {};
    activeDocs.forEach(d => {
      const doc = d.cnpj_tomador || "";
      const name = d.nome_tomador || "Cliente não identificado";
      if (!doc) return;
      if (!map[doc]) {
        map[doc] = { name, doc, total: 0, count: 0 };
      }
      map[doc].total += d.valor_bruto;
      map[doc].count += 1;
    });

    const sorted = Object.values(map).sort((a,b) => b.total - a.total);
    
    let acc = 0;
    const items = sorted.map((c) => {
      acc += c.total;
      const accPct = totalBruto > 0 ? (acc / totalBruto) * 100 : 0;
      
      let classABC: "A" | "B" | "C" = "C";
      if (accPct <= 80) classABC = "A";
      else if (accPct <= 95) classABC = "B";

      return {
        ...c,
        acc,
        accPct,
        classABC,
        pct: totalBruto > 0 ? (c.total / totalBruto) * 100 : 0
      };
    });

    return items;
  }, [activeDocs, totalBruto]);

  const rankingData = useMemo(() => clientABC.slice(0, 15), [clientABC]);

  // Pie chart participation data
  const pieParticipationData = useMemo(() => {
    const sorted = [...clientABC];
    const TOP = 6;
    const top = sorted.slice(0, TOP);
    const rest = sorted.slice(TOP);
    const outrosBruto = rest.reduce((s, r) => s + r.total, 0);

    const result = top.map((e, idx) => ({
      name: e.name,
      value: e.total,
      color: PALETA[idx % PALETA.length],
      pct: e.pct
    }));

    if (outrosBruto > 0) {
      result.push({
        name: "Outros Clientes",
        value: outrosBruto,
        color: C.muted,
        pct: totalBruto > 0 ? (outrosBruto / totalBruto) * 100 : 0
      });
    }

    return result;
  }, [clientABC, totalBruto]);

  // Curva ABC graph data
  const abcGraphData = useMemo(() => {
    return clientABC.slice(0, 15).map((c) => ({
      name: c.name.slice(0, 12) + (c.name.length > 12 ? "." : ""),
      faturamento: c.total,
      "Acumulado %": c.accPct
    }));
  }, [clientABC]);

  // Check concentration threshold violations
  const thresholdViolations = useMemo(() => {
    return clientABC.filter(c => c.pct > concentrationThreshold);
  }, [clientABC, concentrationThreshold]);

  // Segregation statistics
  const segregacao = useMemo(() => {
    let pfTotal = 0;
    let pjTotal = 0;
    const pfSet = new Set<string>();
    const pjSet = new Set<string>();

    activeDocs.forEach((d) => {
      const clean = (d.cnpj_tomador || "").replace(/\D/g, "");
      if (clean.length === 11) {
        pfTotal += d.valor_bruto;
        pfSet.add(clean);
      } else if (clean.length === 14) {
        pjTotal += d.valor_bruto;
        pjSet.add(clean);
      }
    });

    const total = pfTotal + pjTotal;
    const pfPct = total > 0 ? (pfTotal / total) * 100 : 0;
    const pjPct = total > 0 ? (pjTotal / total) * 100 : 0;

    return {
      pfTotal,
      pfClientsQtd: pfSet.size,
      pfPct,
      pjTotal,
      pjClientsQtd: pjSet.size,
      pjPct,
    };
  }, [activeDocs]);

  const hasData = clientABC.length > 0;

  return (
    <div className="p-6 bg-background space-y-6 max-w-[1440px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Dashboard de Clientes
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Concentração e risco comercial: analise a distribuição de faturamento por tomador e monitore riscos de dependência.
        </p>
      </div>

      {/* Global Filters */}
      <GlobalFilters />

      {!hasData ? (
        <Card className="border-border">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            Sem dados suficientes para carregar as análises de clientes. Importe notas fiscais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Concentration threshold configurations & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Threshold Slider Card */}
            <div className="lg:col-span-4 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-foreground">
                  <Settings className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Limite de Concentração Comercial</h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Defina o percentual máximo desejável de faturamento por cliente único. Clientes acima deste limite acionam alertas de risco comercial.
                </p>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Limite Prudencial</span>
                  <span className="text-primary font-mono">{concentrationThreshold}%</span>
                </div>
                <Slider
                  value={[concentrationThreshold]}
                  onValueChange={(val) => setConcentrationThreshold(val[0])}
                  max={50}
                  min={10}
                  step={5}
                  className="py-2"
                />
              </div>
            </div>

            {/* Threshold Violations Alerts */}
            <div className="lg:col-span-8 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-foreground">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <h3 className="text-sm font-semibold">Alertas de Concentração</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Monitoramento reativo baseado em NFS-e. Clientes com peso individual superior a {concentrationThreshold}% do faturamento.
                </p>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto max-h-[120px] space-y-2 pr-1">
                {thresholdViolations.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Nenhum cliente único excede o limite prudencial de {concentrationThreshold}%. Risco de concentração comercial baixo.</span>
                  </div>
                ) : (
                  thresholdViolations.map((v) => (
                    <div key={v.doc} className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 animate-in fade-in duration-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Dependência Comercial Elevada:</strong> O cliente <strong>{v.name}</strong> ({fmtCnpj(v.doc)}) representa <strong>{v.pct.toFixed(1)}%</strong> ({fmtBRL(v.total)}) do faturamento consolidado. Excede o teto configurado de {concentrationThreshold}%.
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Client Rankings & ABC curve */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Horizontal Bar Chart (Ranking) */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Ranking de Clientes</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Top 15 maiores tomadores por receita acumulada</p>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingData} layout="vertical" margin={{ left: -10, right: 15, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "..." : v} />
                    <Tooltip />
                    <Bar dataKey="total" name="Receita" fill={C.blue} radius={[0, 3, 3, 0]} maxBarSize={15}>
                      {rankingData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.pct > concentrationThreshold ? C.rose : C.blue}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Composite ABC Curve */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Distribuição Acumulada (Curva ABC)</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Evolução da contribuição acumulada dos clientes no faturamento</p>
              </div>
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={abcGraphData} margin={{ top: 10, right: -5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                    <Bar yAxisId="left" dataKey="faturamento" name="Faturamento Bruto" fill={C.teal} radius={[3, 3, 0, 0]} maxBarSize={25} />
                    <Line yAxisId="right" type="monotone" dataKey="Acumulado %" name="Percentual Acumulado" stroke={C.rose} strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Segregation PF vs PJ & Document Validator Widget */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Corporate vs Retail Segregation (PF vs PJ) */}
            <div className="lg:col-span-5 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Segregação Varejo vs Corporate</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Divisão de faturamento baseado na natureza do cliente (CPF vs CNPJ)</p>
              </div>
              
              <div className="h-52 w-full mt-4 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Corporate (CNPJ)", value: segregacao.pjTotal, color: C.blue, pct: segregacao.pjPct },
                        { name: "Varejo (CPF)", value: segregacao.pfTotal, color: C.green, pct: segregacao.pfPct }
                      ].filter(i=>i.value>0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {[
                        { name: "Corporate (CNPJ)", value: segregacao.pjTotal, color: C.blue, pct: segregacao.pjPct },
                        { name: "Varejo (CPF)", value: segregacao.pfTotal, color: C.green, pct: segregacao.pfPct }
                      ].filter(i=>i.value>0).map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs py-1 rounded bg-blue-500/5 px-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Corporate (CNPJ)</span>
                  </span>
                  <span className="font-semibold text-foreground">{fmtPct(segregacao.pjPct)} ({fmtBRLCompact(segregacao.pjTotal)})</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 rounded bg-emerald-500/5 px-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">Varejo (CPF)</span>
                  </span>
                  <span className="font-semibold text-foreground">{fmtPct(segregacao.pfPct)} ({fmtBRLCompact(segregacao.pfTotal)})</span>
                </div>
              </div>
            </div>

            {/* Document Validator Playground Widget (Preserved feature) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Playground de Validação Cadastral</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Valide CPFs e CNPJs e consulte nomes sugeridos baseados no banco nacional</p>
              </div>

              <div className="mt-4 flex-1 space-y-4">
                <TomadorDocumentField onDocumentChange={(d) => setValidatedDoc(d)} />

                {validatedDoc && validatedDoc.raw && (
                  <div className="p-3 bg-muted/40 border border-border/80 rounded-xl text-xs space-y-1 animate-in fade-in duration-200">
                    <div className="font-bold text-[10px] text-muted-foreground uppercase">Resultado da Validação:</div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Documento</span>
                        <span className="font-mono font-semibold text-foreground">{fmtCnpj(validatedDoc.documento)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Tipo</span>
                        <span className="font-semibold text-foreground">{validatedDoc.tipo}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Status</span>
                        {validatedDoc.valido ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-0 h-5 text-[9px]">Válido</Badge>
                        ) : (
                          <Badge className="bg-rose-500/10 text-rose-700 border-0 h-5 text-[9px]">Inválido</Badge>
                        )}
                      </div>
                      {validatedDoc.nome_sugerido && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[10px]">Razão Social Sugerida</span>
                          <span className="font-semibold text-foreground">{validatedDoc.nome_sugerido}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table: Client contribution list */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Database className="h-4 w-4 text-muted-foreground" />
                Relação Analítica de Clientes & Receita Acumulada
              </CardTitle>
              <CardDescription>
                Lista completa de tomadores ativos, ordenada de forma decrescente pelo volume bruto de faturamento, com percentual acumulado para classificação de Curva ABC.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-xl border-t border-border">
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">CNPJ/CPF</TableHead>
                      <TableHead className="text-xs">Razão Social / Nome Tomador</TableHead>
                      <TableHead className="text-xs text-center">NFS-e</TableHead>
                      <TableHead className="text-xs text-center">ABC Class</TableHead>
                      <TableHead className="text-xs text-right">Faturamento Bruto</TableHead>
                      <TableHead className="text-xs text-right">Acumulado %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientABC.map((cli, idx) => (
                      <TableRow key={idx} className={cli.pct > concentrationThreshold ? "bg-rose-500/5 hover:bg-rose-500/10" : ""}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{fmtCnpj(cli.doc)}</TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">{cli.name}</TableCell>
                        <TableCell className="text-xs text-center font-mono">{cli.count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                            cli.classABC === "A"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                              : cli.classABC === "B"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            Classe {cli.classABC}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-foreground">{fmtBRL(cli.total)}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-muted-foreground">
                          {cli.accPct.toFixed(1)}% {cli.pct > concentrationThreshold && <span className="text-rose-600 font-bold ml-1">(! Risco)</span>}
                        </TableCell>
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
