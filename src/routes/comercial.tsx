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
  PieChart, Pie, Cell, Legend, CartesianGrid, ComposedChart, Line
} from "recharts";
import { Users, Landmark, Coins, TrendingUp, HelpCircle, MapPin, Tag } from "lucide-react";
import { GlobalFilters } from "@/components/GlobalFilters";

export const Route = createFileRoute("/comercial")({
  component: ComercialPage,
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

function ComercialPage() {
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

  // Derive Contract type / Convênio analytically
  const convenioData = useMemo(() => {
    let saudeVal = 0;
    let corpVal = 0;
    let avulsoVal = 0;

    activeDocs.forEach((d) => {
      const name = (d.nome_tomador || "").toUpperCase();
      const desc = (d.descricao_servico || "").toUpperCase();

      if (name.includes("MEDIC") || name.includes("SAUDE") || name.includes("CLINICA") || name.includes("HOSPITAL") || name.includes("ODONTO")) {
        saudeVal += d.valor_bruto;
      } else if (name.includes("S.A.") || name.includes("LTDA") || name.includes("COOP") || name.includes("TECNOLOGIA") || name.includes("S/A") || desc.includes("CONTRATO") || desc.includes("OPEX")) {
        corpVal += d.valor_bruto;
      } else {
        avulsoVal += d.valor_bruto;
      }
    });

    const list = [
      { name: "Convênio Saúde", value: saudeVal, color: C.blue },
      { name: "Contrato Corp", value: corpVal, color: C.teal },
      { name: "Avulso / Outros", value: avulsoVal, color: C.purple },
    ];
    return list.filter(item => item.value > 0);
  }, [activeDocs]);

  // Group by client and compute ABC Curve
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

  // Top 20 Clients
  const top20Clients = useMemo(() => clientABC.slice(0, 20), [clientABC]);

  // Curva ABC graph data (Top 15 + accumulated line)
  const abcGraphData = useMemo(() => {
    return clientABC.slice(0, 15).map((c, idx) => ({
      name: c.name.slice(0, 15) + (c.name.length > 15 ? "." : ""),
      faturamento: c.total,
      "Acumulado %": c.accPct
    }));
  }, [clientABC]);

  // Group by municipality
  const munData = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach(d => {
      const mun = d.municipio || "Não Informado";
      map[mun] = (map[mun] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);
  }, [activeDocs]);

  // Group by category
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach(d => {
      const cat = d.categoria || "Não Classificado";
      map[cat] = (map[cat] || 0) + d.valor_bruto;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [activeDocs]);

  // Monthly evolution of top 5 clients
  const clientEvolutionData = useMemo(() => {
    // Get top 5 clients CNPJ
    const top5Cnpjs = clientABC.slice(0, 5).map(c => c.doc);
    const top5Names = clientABC.slice(0, 5).map(c => c.name);

    // Get last 6 months
    let anchorYm = "";
    (docs ?? []).forEach(d => {
      if (d.data_competencia && d.data_competencia.slice(0, 7) > anchorYm) {
        anchorYm = d.data_competencia.slice(0, 7);
      }
    });
    if (!anchorYm) anchorYm = new Date().toISOString().slice(0, 7);
    const [anchorY, anchorM] = anchorYm.split("-").map(Number);

    const labels: { ym: string; name: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = anchorM - i;
      let y = anchorY;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      labels.push({
        ym: `${y}-${String(m).padStart(2, "0")}`,
        name: `${NOME_MES[String(m).padStart(2, "0")]}/${String(y).slice(2)}`
      });
    }

    const evolutionList = labels.map(l => {
      const obj: Record<string, any> = { name: l.name };
      top5Cnpjs.forEach((cnpj, idx) => {
        obj[top5Names[idx]] = 0;
      });

      activeDocs.forEach(d => {
        if (d.data_competencia?.slice(0,7) === l.ym && d.cnpj_tomador && top5Cnpjs.includes(d.cnpj_tomador)) {
          const idx = top5Cnpjs.indexOf(d.cnpj_tomador);
          obj[top5Names[idx]] += d.valor_bruto;
        }
      });

      return obj;
    });

    return {
      data: evolutionList,
      keys: top5Names
    };
  }, [docs, activeDocs, clientABC]);

  const NOME_MES: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };

  const hasData = activeDocs.length > 0;

  return (
    <div className="p-6 bg-background space-y-6 max-w-[1440px] mx-auto min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          Dashboard Comercial
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Responde quem gera receita: análises de clientes, curva ABC, faturamento geográfico e segmentações.
        </p>
      </div>

      {/* Global Filters */}
      <GlobalFilters />

      {!hasData ? (
        <Card className="border-border">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            Sem dados suficientes para carregar o Dashboard Comercial. Importe NFS-e válidas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Executive Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Receita Bruta Total</span>
                <span className="text-xl font-bold text-foreground font-mono">{fmtBRL(totalBruto)}</span>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <Coins className="h-5 w-5 text-blue-500" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Total de Clientes</span>
                <span className="text-xl font-bold text-foreground font-mono">{clientABC.length}</span>
              </div>
              <div className="p-3 bg-teal-500/10 rounded-xl">
                <Users className="h-5 w-5 text-teal-500" />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Concentração Classe A</span>
                <span className="text-xl font-bold text-primary font-mono">
                  {fmtPct((clientABC.filter(c => c.classABC === "A").reduce((s,c)=>s+c.total,0) / (totalBruto || 1)) * 100)}
                </span>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Row 1: Top 20 Clientes & Curva ABC Composite */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top 20 Clientes (Horizontal Bar) */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Top 20 Clientes</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maiores tomadores por receita bruta no recorte</p>
                </div>
              </div>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top20Clients}
                    layout="vertical"
                    margin={{ left: -10, right: 20, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "..." : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="total" name="Receita Bruta" fill={C.blue} radius={[0, 3, 3, 0]} maxBarSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Curva ABC (Composite Chart) */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Curva ABC de Clientes</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição do faturamento acumulado dos maiores clientes</p>
              </div>
              <div className="h-96 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={abcGraphData} margin={{ top: 10, right: -5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar yAxisId="left" dataKey="faturamento" name="Faturamento Bruto" fill={C.teal} radius={[3, 3, 0, 0]} maxBarSize={25} />
                    <Line yAxisId="right" type="monotone" dataKey="Acumulado %" stroke={C.rose} strokeWidth={2} dot={{ r: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Municípios, Categorias, Convênios */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Receita por Município */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Município</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Top 10 cidades tomadoras por volume</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={munData} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Receita" fill={C.amber} radius={[0, 3, 3, 0]} maxBarSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Receita por Categoria */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Categoria</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Participação no faturamento por classificação gerencial</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={catData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {catData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Receita por Convênio */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Receita por Segmento de Contrato</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Segregação comercial derivada de convênios/tipo de faturamento</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={convenioData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {convenioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Evolução dos Clientes e Relação Completa */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Evolução de Receita por Cliente */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Evolução Mensal de Clientes</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Histórico mensal dos 5 maiores clientes</p>
              </div>
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientEvolutionData.data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                    {clientEvolutionData.keys.map((key, index) => (
                      <Bar key={key} dataKey={key} stackId="a" fill={PALETA[index % PALETA.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Relação Comercial de Clientes */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-0 overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Relação Comercial de Clientes</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Rendimento e classificação gerencial de tomadores ativos</p>
              </div>
              <div className="flex-1 overflow-auto max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs text-center">ABC</TableHead>
                      <TableHead className="text-xs text-center">Qtd. Notas</TableHead>
                      <TableHead className="text-xs text-right">Faturamento</TableHead>
                      <TableHead className="text-xs text-right">Part. %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientABC.map((cli, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-foreground max-w-[150px] truncate" title={cli.name}>{cli.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{fmtCnpj(cli.doc)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 border ${
                            cli.classABC === "A"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                              : cli.classABC === "B"
                              ? "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            Classe {cli.classABC}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono">{cli.count}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold text-foreground">{fmtBRL(cli.total)}</TableCell>
                        <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtPct(cli.pct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
