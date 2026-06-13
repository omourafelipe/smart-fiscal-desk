import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { 
  Calendar, 
  Tag, 
  Building2, 
  FileSpreadsheet, 
  TrendingUp, 
  ShoppingBag,
  Users,
  Download
} from "lucide-react";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useFiscalData } from "@/hooks/useFiscalData";
import { KpiCardNew } from "@/components/shared/KpiCardNew";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, type NotaFiscal, type NotaFiscalTomada } from "@/lib/db";
import { toast } from "sonner";

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/grupo")({
  validateSearch: searchSchema,
  component: GrupoRouteComponent,
});

const mesesOpcoes = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const BAR_COLORS = [
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f97316", // Orange
];

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (dataStr: string) => {
  if (!dataStr) return "—";
  try {
    const clean = dataStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
};

const formatarCnpjCpf = (val: string) => {
  const clean = String(val ?? "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return val;
};

const getServicoDescricao = (codTrib: string) => {
  const code = String(codTrib).trim();
  if (!code) return "Sem descrição";
  const clean = code.replace(/\D/g, "");
  if (clean.startsWith("422") || clean.startsWith("0422")) return "Plano de Saúde";
  if (
    clean.startsWith("423") || clean.startsWith("0423") ||
    clean.startsWith("403") || clean.startsWith("0403") ||
    clean.startsWith("433") || clean.startsWith("0433")
  ) {
    return "Serviços Hospitalares";
  }
  return `Serviço ${code}`;
};

function GrupoRouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });

  const { periodType, addActivity } = useLayoutShell();

  const mesFiltro = search.mes || "__all__";
  const anoFiltro = search.ano || "__all__";
  const cServFiltro = search.cServ || "__all__";

  const {
    groupStats,
    anos,
    notasAtivas,
    todasNotasTomadas,
    getDateField,
  } = useFiscalData({
    filters: {
      empresaFiltro: "__all__", // consolidado do grupo ignora empresa
      mesFiltro,
      anoFiltro,
      cServFiltro,
      searchCliente: "", // consolidado do grupo ignora busca por cliente
    },
    periodType,
    xlsxRows: [],
    keyCol: "",
    statusCol: "",
  });

  const setMesFiltro = (val: string) => navigate({ search: (prev: any) => ({ ...prev, mes: val === "__all__" ? undefined : val }) });
  const setAnoFiltro = (val: string) => navigate({ search: (prev: any) => ({ ...prev, ano: val === "__all__" ? undefined : val }) });
  const setCServFiltro = (val: string) => navigate({ search: (prev: any) => ({ ...prev, cServ: val === "__all__" ? undefined : val }) });

  // Get active companies (unique prestadores in the DB)
  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    notasAtivas?.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) {
        map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
      }
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [notasAtivas]);

  // Derived active tomadas for group
  const notasTomadasAtivas = useMemo(() => {
    if (!todasNotasTomadas) return [];
    return todasNotasTomadas.filter((n) => {
      if (n.status !== "válida") return false;
      const dateStr = (periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "").slice(0, 10);
      if (mesFiltro !== "__all__" && dateStr.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && dateStr.slice(0, 4) !== anoFiltro) return false;
      return true;
    });
  }, [todasNotasTomadas, mesFiltro, anoFiltro, periodType]);

  // 1. Calculate taxes withheld (ISS retido + federal retidos on both emitidas and tomadas)
  const totalRetido = useMemo(() => {
    const emitidasRetidas = notasAtivas.reduce((sum, n) => {
      const iss = n.issRetido === "Sim" ? (n.vlrIssRet ?? n.vlrIss ?? 0) : 0;
      const fed = (n.vlrCsll ?? 0) + (n.vlrIrrf ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0) + (n.vlrInss ?? 0);
      return sum + iss + fed;
    }, 0);

    const tomadasRetidas = notasTomadasAtivas.reduce((sum, n) => {
      const iss = n.issRetido === "Sim" ? (n.vlrIssRet ?? 0) : 0;
      const fed = (n.vlrCsll ?? 0) + (n.vlrIrrf ?? 0) + (n.vlrPis ?? 0) + (n.vlrCofins ?? 0) + (n.vlrInss ?? 0);
      return sum + iss + fed;
    }, 0);

    return emitidasRetidas + tomadasRetidas;
  }, [notasAtivas, notasTomadasAtivas]);

  // 2. Stacked Bar Chart: billing by company over the active year's months
  const faturamentoPorEmpresaMensal = useMemo(() => {
    const monthlyMap = new Map<string, Record<string, number>>();
    
    // Initialize months 01-12
    for (let i = 1; i <= 12; i++) {
      const mStr = String(i).padStart(2, "0");
      monthlyMap.set(mStr, {});
    }

    // Sum active billing of the year/period
    notasAtivas.forEach((n) => {
      const dateStr = getDateField(n);
      if (!dateStr) return;
      const month = dateStr.slice(5, 7); // MM
      const cnpj = n.cnpjPrestador;
      const currentMonthData = monthlyMap.get(month) || {};
      currentMonthData[cnpj] = (currentMonthData[cnpj] || 0) + n.valor;
      monthlyMap.set(month, currentMonthData);
    });

    const mesesAbrev = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return Array.from(monthlyMap.entries()).map(([month, companyVals]) => {
      const idx = parseInt(month, 10) - 1;
      const item: any = { label: mesesAbrev[idx] };
      empresas.forEach((emp) => {
        item[emp.cnpj] = companyVals[emp.cnpj] || 0;
      });
      return item;
    });
  }, [notasAtivas, empresas, getDateField]);

  // 3. Top 10 clients cross-company ranking
  const top10Clientes = useMemo(() => {
    const map = new Map<string, { cnpjCpf: string; nome: string; total: number; count: number }>();
    
    notasAtivas.forEach((n) => {
      const key = n.cnpjCpfCliente || "Desconhecido";
      const curr = map.get(key) || { cnpjCpf: key, nome: n.cliente || "Desconhecido", total: 0, count: 0 };
      curr.total += n.valor;
      curr.count += 1;
      map.set(key, curr);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [notasAtivas]);

  // 4. Excel Consolidated Export Trigger
  const handleExportConsolidado = async () => {
    try {
      const { exportConsolidadoXlsx } = await import("@/lib/exports/exportXlsx");
      
      // Fetch full arrays from DB to filter
      const allEmitidas = await db.notas.toArray();
      const allTomadas = await db.notasTomadas.toArray();

      // Apply current month/year filters
      const filteredEmitidas = allEmitidas.filter((n) => {
        const ds = getDateField(n);
        if (mesFiltro !== "__all__" && ds.slice(5, 7) !== mesFiltro) return false;
        if (anoFiltro !== "__all__" && ds.slice(0, 4) !== anoFiltro) return false;
        return true;
      });

      const filteredTomadas = allTomadas.filter((n) => {
        const ds = (periodType === "competencia" && n.dCompet ? n.dCompet : n.dhEmi || "").slice(0, 10);
        if (mesFiltro !== "__all__" && ds.slice(5, 7) !== mesFiltro) return false;
        if (anoFiltro !== "__all__" && ds.slice(0, 4) !== anoFiltro) return false;
        return true;
      });

      await exportConsolidadoXlsx(filteredEmitidas, filteredTomadas, empresas, periodType);
      addActivity("export", "Excel Consolidado Exportado", "Relatório multi-empresa gerado com sucesso.");
      toast.success("Excel consolidado do grupo exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar relatório Excel.");
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* PAGE MAIN HEADER / FILTERS PANEL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Resumo Consolidado do Grupo
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Métricas acumuladas de todas as empresas do grupo ativo · Regime: {periodType === "competencia" ? "Competência" : "Emissão"}
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Export XLS button */}
          <Button
            onClick={handleExportConsolidado}
            className="flex items-center gap-2 px-4 h-9 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer hover:scale-[1.01] transition-all"
          >
            <Download className="h-4 w-4" />
            Exportar Consolidado XLSX
          </Button>

          {/* Month Select */}
          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors cursor-pointer">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {mesesOpcoes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Select */}
          <Select value={anoFiltro} onValueChange={setAnoFiltro}>
            <SelectTrigger className="w-[105px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors cursor-pointer">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os anos</SelectItem>
              {anos.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Service Select */}
          <Select value={cServFiltro} onValueChange={setCServFiltro}>
            <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl bg-muted border-border hover:bg-muted/80 transition-colors cursor-pointer">
              <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg border-border bg-popover text-popover-foreground">
              <SelectItem value="__all__">Todos os Serviços</SelectItem>
              <SelectItem value="042201">Planos de Saúde</SelectItem>
              <SelectItem value="040301">Serviços Hospitalares</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* METRICS / KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCardNew
          label="Faturamento Bruto do Grupo"
          value={fmtBRL(groupStats.totalGroupBilling)}
          trendText="Consolidado"
          isPositive={true}
          subtext="Total emitido pelas empresas"
          tone="blue"
        />
        <KpiCardNew
          label="Tributos Retidos na Fonte"
          value={fmtBRL(totalRetido)}
          trendText="Total"
          isPositive={true}
          subtext="ISS e federais retidos"
          tone="rose"
        />
        <KpiCardNew
          label="Notas Emitidas"
          value={`${notasAtivas.length} NFS-e`}
          trendText="Serviços Prestados"
          isPositive={true}
          subtext="Notas de faturamento emitidas"
          tone="green"
        />
        <KpiCardNew
          label="Notas Tomadas"
          value={`${notasTomadasAtivas.length} NFS-e`}
          trendText="Serviços Contratados"
          isPositive={true}
          subtext="Notas recebidas de fornecedores"
          tone="amber"
        />
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recharts Stacked Bar Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-7 transition-colors duration-300">
          <h3 className="text-xs font-bold text-foreground mb-1">Faturamento por Empresa</h3>
          <p className="text-[10px] text-muted-foreground mb-4 font-medium">Comparação mensal da sazonalidade de faturamento entre os CNPJs do grupo</p>
          
          <div className="h-[320px]">
            {empresas.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={faturamentoPorEmpresaMensal}
                  margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v) => fmtBRL(Number(v))}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      borderColor: "var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-foreground)",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 9, paddingTop: 10 }} />
                  {empresas.map((emp, index) => (
                    <Bar
                      key={emp.cnpj}
                      dataKey={emp.cnpj}
                      name={emp.nome.length > 20 ? `${emp.nome.substring(0, 18)}...` : emp.nome}
                      stackId="a"
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* TOP 10 CLIENTS CROSS-COMPANY */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-5 flex flex-col justify-between transition-colors duration-300">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              Top 10 Tomadores do Grupo
            </h3>
            <p className="text-[10px] text-muted-foreground mb-4">Maiores clientes considerando o faturamento unificado de todas as empresas</p>
            
            <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
              {top10Clientes.length === 0 ? (
                <EmptyState />
              ) : (
                top10Clientes.map((c, i) => {
                  const share = groupStats.totalGroupBilling > 0 ? (c.total / groupStats.totalGroupBilling) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground/90 truncate max-w-[220px]" title={c.nome}>
                          {i + 1}. {c.nome}
                        </span>
                        <span className="font-bold text-foreground">{fmtBRL(c.total)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${share}%` }} />
                      </div>
                      <div className="flex justify-between text-[8px] text-muted-foreground font-mono">
                        <span>Doc: {formatarCnpjCpf(c.cnpjCpf)}</span>
                        <span>Share: {share.toFixed(2)}% · {c.count} notas</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABLE: RESUMO POR EMPRESA */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
        <div className="p-5 border-b border-border">
          <h3 className="text-xs font-bold text-foreground">Resumo por Empresa do Grupo</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visão consolidada das notas válidas e seus faturamentos brutos e líquidos</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead className="font-medium text-muted-foreground h-9">Empresa</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9 text-center">Qtd. Notas</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Faturamento Bruto</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Eliminação Intergrupo</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Faturamento Líquido (Externo)</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Share %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupStats.companyList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                    Nenhuma empresa identificada com notas válidas no período.
                  </TableCell>
                </TableRow>
              ) : (
                groupStats.companyList.map((c, idx) => (
                  <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <TableCell className="max-w-[200px]">
                      <div className="font-semibold text-foreground/90 truncate" title={c.nome}>{c.nome}</div>
                      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{formatarCnpjCpf(c.cnpj)}</div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-[10px] text-muted-foreground">{c.count}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">{fmtBRL(c.total)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400 font-semibold">{fmtBRL(c.intergrupo)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{fmtBRL(c.externo)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground/85 font-semibold">{c.share.toFixed(2)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* TABLE: NOTAS INTERGRUPO */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden transition-colors duration-300">
        <div className="p-5 border-b border-border">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Notas Emitidas entre Empresas do Grupo ({groupStats.intergroupNotes.length})
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Notas fiscais onde o prestador e o tomador são empresas pertencentes ao grupo</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead className="font-medium text-muted-foreground h-9">Nº NFS</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Emissão</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Prestador (Emitente)</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Tomador (Destinatário)</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground h-9">Valor do Serviço</TableHead>
                <TableHead className="font-medium text-muted-foreground h-9">Serviço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupStats.intergroupNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                    Nenhuma transação intergrupo identificada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                groupStats.intergroupNotes.map((n, idx) => (
                  <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-[10px] text-foreground/95 font-semibold">{n.nNFSe}</TableCell>
                    <TableCell className="text-xs text-foreground/90 whitespace-nowrap">{formatarData(n.dhEmi)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      <div className="font-semibold text-foreground/90 truncate" title={n.nomePrestador || n.cnpjPrestador}>
                        {n.nomePrestador || n.cnpjPrestador}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                        {formatarCnpjCpf(n.cnpjPrestador)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      <div className="font-semibold text-foreground/90 truncate" title={n.tomadorNome}>
                        {n.tomadorNome}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                        {formatarCnpjCpf(n.cnpjCpfCliente)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-foreground">{fmtBRL(n.valor)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={n.codTribNacional ? getServicoDescricao(n.codTribNacional) : "—"}>
                      {n.codTribNacional ? getServicoDescricao(n.codTribNacional) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
