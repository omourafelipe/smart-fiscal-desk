import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Calendar, Tag, Building2 } from "lucide-react";
import { useLayoutShell } from "@/components/layout/LayoutShell";
import { useFiscalData } from "@/hooks/useFiscalData";
import { KpiCardNew } from "@/components/shared/KpiCardNew";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const { periodType, setPeriodType, addActivity } = useLayoutShell();

  const mesFiltro = search.mes || "__all__";
  const anoFiltro = search.ano || "__all__";
  const cServFiltro = search.cServ || "__all__";

  const {
    groupStats,
    groupLineChartData,
    anos,
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

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* PAGE MAIN HEADER / FILTERS PANEL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-wrap bg-card p-5 rounded-2xl border border-border shadow-xs transition-colors duration-300">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Resumo Consolidado do Grupo</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Faturamento consolidado do grupo · Filtros de empresa individual e busca são ignorados nesta aba
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
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
          subtext="Soma de todas as NFS-e válidas"
          tone="blue"
        />
        <KpiCardNew
          label="Eliminação Intergrupo"
          value={fmtBRL(groupStats.totalIntergrupoBilling)}
          trendText={`${(groupStats.totalGroupBilling > 0 ? (groupStats.totalIntergrupoBilling / groupStats.totalGroupBilling * 100) : 0).toFixed(1)}%`}
          isPositive={false}
          subtext="Faturamento entre empresas do grupo"
          tone="rose"
        />
        <KpiCardNew
          label="Faturamento Líquido (Externo)"
          value={fmtBRL(groupStats.totalExternalBilling)}
          trendText={`${(groupStats.totalGroupBilling > 0 ? (groupStats.totalExternalBilling / groupStats.totalGroupBilling * 100) : 0).toFixed(1)}%`}
          isPositive={true}
          subtext="Faturamento gerado com terceiros"
          tone="green"
        />
        <KpiCardNew
          label="Transações Intergrupo"
          value={`${groupStats.intergroupNotes.length} notas`}
          trendText="Interno"
          isPositive={true}
          subtext="Notas emitidas entre empresas do grupo"
          tone="amber"
        />
      </div>

      {/* Evolução do Faturamento Mensal do Grupo */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs transition-colors duration-300">
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-foreground">Evolução Mensal do Faturamento do Grupo</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Faturamento bruto consolidado, faturamento líquido e eliminações intergrupo</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1]" />
              <span>Faturamento Bruto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              <span>Faturamento Líquido (Externo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
              <span>Eliminação Intergrupo</span>
            </div>
          </div>
        </div>
        
        <div className="h-[280px]">
          {groupLineChartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={groupLineChartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLiquido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIntergrupo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={10} axisLine={false} tickLine={false} />
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
                <Area
                  type="monotone"
                  dataKey="Faturamento Bruto"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBruto)"
                />
                <Area
                  type="monotone"
                  dataKey="Faturamento Líquido"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLiquido)"
                />
                <Area
                  type="monotone"
                  dataKey="Faturamento Intergrupo"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#colorIntergrupo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recharts Stacked Bar Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-7 transition-colors duration-300">
          <h3 className="text-xs font-bold text-foreground mb-1">Faturamento por Empresa</h3>
          <p className="text-[10px] text-muted-foreground mb-4">Breakdown por faturamento externo e transações internas (intergrupo)</p>
          
          <div className="h-[320px]">
            {groupStats.companyList.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupStats.companyList}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" opacity={0.4} />
                  <XAxis
                    type="number"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                    tickFormatter={(name) => {
                      if (name.length > 20) return `${name.substring(0, 18)}...`;
                      return name;
                    }}
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
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                  <Bar dataKey="externo" name="Faturamento Externo" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="intergrupo" name="Faturamento Intergrupo" stackId="a" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Company Share Breakdown List */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs lg:col-span-5 flex flex-col justify-between transition-colors duration-300">
          <div>
            <h3 className="text-xs font-bold text-foreground mb-1">Participação no Faturamento</h3>
            <p className="text-[10px] text-muted-foreground mb-4">Share de cada empresa sobre o faturamento bruto consolidado do grupo</p>
            
            <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
              {groupStats.companyList.length === 0 ? (
                <EmptyState />
              ) : (
                groupStats.companyList.map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground/90 truncate max-w-[200px]" title={c.nome}>
                        {c.nome}
                      </span>
                      <span className="font-bold text-foreground">{c.share.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${c.share}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                      <span>Externo: {fmtBRL(c.externo)}</span>
                      <span>Intergrupo: {fmtBRL(c.intergrupo)}</span>
                    </div>
                  </div>
                ))
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
