import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
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
import { Calculator, Coins, ShieldAlert, Receipt, Percent, FileText } from "lucide-react";
import { GlobalFilters } from "@/components/GlobalFilters";

export const Route = createFileRoute("/tributario")({
  component: TributarioPage,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtBRLCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}K`;
  return fmtBRL(n);
};

const fmtPct = (n: number) => `${n.toFixed(2)}%`;

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

const TAX_PALETTE = {
  iss: C.blue,
  irrf: C.rose,
  csll: C.amber,
  pis: C.teal,
  cofins: C.purple,
  inss: C.orange,
};

function TributarioPage() {
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

  // Sum all tax fields
  const taxKpis = useMemo(() => {
    let bruto = 0;
    let liquido = 0;
    let iss = 0;
    let iss_ret = 0;
    let irrf = 0;
    let csll = 0;
    let pis = 0;
    let cofins = 0;
    let inss = 0;
    let totalRet = 0;

    activeDocs.forEach((d) => {
      bruto += d.valor_bruto;
      liquido += d.valor_liquido;
      iss += d.vlr_iss || 0;
      iss_ret += d.vlr_iss_ret || 0;
      irrf += d.vlr_irrf || 0;
      csll += d.vlr_csll || 0;
      pis += d.vlr_pis || 0;
      cofins += d.vlr_cofins || 0;
      inss += d.vlr_inss || 0;
      totalRet += d.valor_retido || 0;
    });

    const sumTaxes = iss + irrf + csll + pis + cofins + inss;
    const aliquotaEfetiva = bruto > 0 ? (sumTaxes / bruto) * 100 : 0;

    return {
      bruto,
      liquido,
      iss,
      iss_ret,
      irrf,
      csll,
      pis,
      cofins,
      inss,
      totalRet,
      sumTaxes,
      aliquotaEfetiva,
    };
  }, [activeDocs]);

  // Tax Waterfall data (Receita Bruta -> taxes -> Receita Líquida)
  const waterfallData = useMemo(() => {
    const { bruto, iss, irrf, csll, pis, cofins, inss, liquido } = taxKpis;

    // We build the steps downward
    let current = bruto;
    
    const steps = [
      { name: "Receita Bruta", base: 0, value: bruto, color: C.blue },
      { name: "ISS", base: current - iss, value: iss, color: TAX_PALETTE.iss },
      { name: "IRRF", base: current - iss - irrf, value: irrf, color: TAX_PALETTE.irrf },
      { name: "CSLL", base: current - iss - irrf - csll, value: csll, color: TAX_PALETTE.csll },
      { name: "PIS", base: current - iss - irrf - csll - pis, value: pis, color: TAX_PALETTE.pis },
      { name: "COFINS", base: current - iss - irrf - csll - pis - cofins, value: cofins, color: TAX_PALETTE.cofins },
      { name: "INSS", base: liquido, value: inss, color: TAX_PALETTE.inss },
      { name: "Receita Líquida", base: 0, value: liquido, color: C.green },
    ];

    return steps.filter(s => s.value > 0 || s.name === "Receita Bruta" || s.name === "Receita Líquida");
  }, [taxKpis]);

  // Tax evolution last 12 months (stacked bar chart)
  const taxEvolutionData = useMemo(() => {
    let anchorYm = "";
    (docs ?? []).forEach(d => {
      if (d.data_competencia && d.data_competencia.slice(0, 7) > anchorYm) {
        anchorYm = d.data_competencia.slice(0, 7);
      }
    });
    if (!anchorYm) anchorYm = new Date().toISOString().slice(0, 7);
    const [anchorY, anchorM] = anchorYm.split("-").map(Number);

    const labels: { ym: string; name: string }[] = [];
    for (let i = 11; i >= 0; i--) {
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

    const map: Record<string, Record<string, number>> = {};
    labels.forEach(l => {
      map[l.ym] = { iss: 0, irrf: 0, csll: 0, pis: 0, cofins: 0, inss: 0 };
    });

    filtrados.forEach(d => {
      const ym = d.data_competencia?.slice(0, 7);
      if (ym && map[ym]) {
        map[ym].iss += d.vlr_iss || 0;
        map[ym].irrf += d.vlr_irrf || 0;
        map[ym].csll += d.vlr_csll || 0;
        map[ym].pis += d.vlr_pis || 0;
        map[ym].cofins += d.vlr_cofins || 0;
        map[ym].inss += d.vlr_inss || 0;
      }
    });

    return labels.map(l => ({
      name: l.name,
      ...map[l.ym]
    }));
  }, [docs, filtrados]);

  // Tax withholding by Client
  const retentionByClient = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach(d => {
      const cli = d.nome_tomador || d.cnpj_tomador || "Desconhecido";
      const totalTaxes = (d.vlr_iss_ret || 0) + (d.vlr_csll || 0) + (d.vlr_irrf || 0) + (d.vlr_pis || 0) + (d.vlr_cofins || 0) + (d.vlr_inss || 0);
      if (totalTaxes > 0) {
        map[cli] = (map[cli] || 0) + totalTaxes;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);
  }, [activeDocs]);

  // Tax withholding by Municipality (ISS)
  const retentionByMunicipality = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach(d => {
      const mun = d.municipio || "Não Informado";
      const iss = d.vlr_iss || 0;
      if (iss > 0) {
        map[mun] = (map[mun] || 0) + iss;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 10);
  }, [activeDocs]);

  // Tax withholding by Category
  const retentionByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    activeDocs.forEach(d => {
      const cat = d.categoria || "Não Classificado";
      const totalTaxes = (d.vlr_iss || 0) + (d.vlr_csll || 0) + (d.vlr_irrf || 0) + (d.vlr_pis || 0) + (d.vlr_cofins || 0) + (d.vlr_inss || 0);
      if (totalTaxes > 0) {
        map[cat] = (map[cat] || 0) + totalTaxes;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [activeDocs]);

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
          <Calculator className="h-6 w-6 text-primary" />
          Dashboard Tributário
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Responde qual é a carga tributária da empresa: análise detalhada de ISS, CSLL, PIS, COFINS, IRRF e INSS.
        </p>
      </div>

      {/* Global Filters */}
      <GlobalFilters />

      {!hasData ? (
        <Card className="border-border">
          <CardContent className="py-20 text-center text-sm text-muted-foreground">
            Sem dados suficientes para carregar o Dashboard Tributário. Importe notas fiscais com retenções.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
            {[
              { label: "ISS", value: taxKpis.iss, color: TAX_PALETTE.iss },
              { label: "ISS Retido", value: taxKpis.iss_ret, color: C.teal },
              { label: "IRRF", value: taxKpis.irrf, color: TAX_PALETTE.irrf },
              { label: "CSLL", value: taxKpis.csll, color: TAX_PALETTE.csll },
              { label: "PIS", value: taxKpis.pis, color: TAX_PALETTE.pis },
              { label: "COFINS", value: taxKpis.cofins, color: TAX_PALETTE.cofins },
              { label: "INSS", value: taxKpis.inss, color: TAX_PALETTE.inss },
              { label: "Retenções Total", value: taxKpis.totalRet, color: C.pink },
              { label: "Alíquota Efetiva", value: taxKpis.aliquotaEfetiva, color: C.rose, isPct: true }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-card border border-border rounded-xl p-3.5 shadow-sm text-center relative overflow-hidden flex flex-col justify-between h-24">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">{kpi.label}</span>
                <span className="text-sm font-bold text-foreground font-mono truncate block mt-2">
                  {kpi.isPct ? fmtPct(kpi.value) : fmtBRLCompact(kpi.value)}
                </span>
                <div className="h-1 w-8 rounded-full mx-auto mt-2" style={{ background: kpi.color }} />
              </div>
            ))}
          </div>

          {/* Row 1: Waterfall Tributário & Evolução Mensal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Waterfall Tributário */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Waterfall de Impostos</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Dedução detalhada de cada imposto sobre a receita bruta</p>
              </div>
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<WaterfallTooltip />} />
                    <Bar dataKey="base" stackId="a" fill="transparent" />
                    <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evolução Mensal dos Tributos */}
            <div className="lg:col-span-6 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Evolução Mensal de Tributos</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Visão mensal consolidada por categoria tributária nos últimos 12 meses</p>
              </div>
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taxEvolutionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                    <Bar dataKey="iss" name="ISS" stackId="a" fill={TAX_PALETTE.iss} />
                    <Bar dataKey="irrf" name="IRRF" stackId="a" fill={TAX_PALETTE.irrf} />
                    <Bar dataKey="csll" name="CSLL" stackId="a" fill={TAX_PALETTE.csll} />
                    <Bar dataKey="pis" name="PIS" stackId="a" fill={TAX_PALETTE.pis} />
                    <Bar dataKey="cofins" name="COFINS" stackId="a" fill={TAX_PALETTE.cofins} />
                    <Bar dataKey="inss" name="INSS" stackId="a" fill={TAX_PALETTE.inss} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Clientes, Municípios, Categorias */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Retenção por Cliente */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Retenção por Cliente</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Top 10 clientes com maior volume de impostos retidos</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={retentionByClient} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} axisLine={false} tickLine={false} tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + "..." : v} />
                    <Tooltip />
                    <Bar dataKey="value" name="Impostos Retidos" fill={C.rose} radius={[0, 3, 3, 0]} maxBarSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Retenção por Município (ISS) */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Retenção de ISS por Município</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento de ISS retido nas prefeituras tomadoras</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={retentionByMunicipality} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => fmtBRLCompact(Number(v))} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="ISS por Município" fill={C.blue} radius={[0, 3, 3, 0]} maxBarSize={15} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Retenção por Categoria */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Retenção por Categoria</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Incidência de tributos nas categorias de serviço</p>
              </div>
              <div className="h-64 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={retentionByCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {retentionByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={fmtBRL} />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
