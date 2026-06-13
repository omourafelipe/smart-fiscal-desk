import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { db, type NotaFiscal } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Building2, Calendar, FileBarChart, Receipt } from "lucide-react";

import { useLayoutShell } from "@/components/layout/LayoutShell";

const searchSchema = z.object({
  empresa: z.string().optional().catch("__all__"),
  mesInicio: z.string().optional().catch("01"),
  anoInicio: z.string().optional().catch("2026"),
  mesFim: z.string().optional().catch("12"),
  anoFim: z.string().optional().catch("2026"),
});

export const Route = createFileRoute("/relatorio")({
  validateSearch: searchSchema,
  component: RelatorioDRE,
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

function RelatorioDRE() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });
  const { periodType } = useLayoutShell();

  // Read URL search params with fallback
  const empresaFiltro = search.empresa || "__all__";
  const mesInicio = search.mesInicio || "01";
  const anoInicio = search.anoInicio || "2026";
  const mesFim = search.mesFim || "12";
  const anoFim = search.anoFim || "2026";

  const updateFilters = (updates: Partial<z.infer<typeof searchSchema>>) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        ...updates,
      }),
    });
  };

  // 1. Fetch all emitidas from IndexedDB
  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);

  const getDateField = (n: { dhEmi: string; dCompet?: string }) => {
    if (periodType === "competencia" && n.dCompet) {
      return n.dCompet.split("T")[0];
    }
    return (n.dhEmi || "").split("T")[0];
  };

  // 2. Derive list of unique companies (prestadores)
  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    todasNotas.forEach((n) => {
      if (!map.has(n.cnpjPrestador)) {
        map.set(n.cnpjPrestador, n.nomePrestador || n.cnpjPrestador);
      }
    });
    return Array.from(map.entries()).map(([cnpj, nome]) => ({ cnpj, nome }));
  }, [todasNotas]);

  // 3. Filter notes for DRE (must be válidas, matching company, and matching date range)
  const notasFiltradas = useMemo(() => {
    const startKey = `${anoInicio}-${mesInicio}`;
    const endKey = `${anoFim}-${mesFim}`;

    return todasNotas.filter((n) => {
      if (n.status !== "válida") return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;

      // Determine date of note
      const dateStr = getDateField(n).slice(0, 7); // YYYY-MM
      if (!dateStr) return false;

      return dateStr >= startKey && dateStr <= endKey;
    });
  }, [todasNotas, empresaFiltro, mesInicio, anoInicio, mesFim, anoFim, periodType]);

  // 4. Extract years available in the database for dropdowns
  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    todasNotas.forEach((n) => {
      const dateStr = getDateField(n);
      if (dateStr) {
        const y = dateStr.slice(0, 4);
        if (y.length === 4) set.add(y);
      }
    });
    if (set.size === 0) set.add("2026");
    return Array.from(set).sort().reverse();
  }, [todasNotas, periodType]);

  // 5. Calculations for the DRE
  const receitaBruta = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + n.valor, 0);
  }, [notasFiltradas]);

  const totalIss = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrIss ?? 0), 0);
  }, [notasFiltradas]);

  const totalPis = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrPis ?? 0), 0);
  }, [notasFiltradas]);

  const totalCofins = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrCofins ?? 0), 0);
  }, [notasFiltradas]);

  const totalDeducoes = useMemo(() => totalIss + totalPis + totalCofins, [totalIss, totalPis, totalCofins]);

  const receitaLiquida = useMemo(() => receitaBruta - totalDeducoes, [receitaBruta, totalDeducoes]);

  const totalCsll = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrCsll ?? 0), 0);
  }, [notasFiltradas]);

  const totalIrrf = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrIrrf ?? 0), 0);
  }, [notasFiltradas]);

  const totalInss = useMemo(() => {
    return notasFiltradas.reduce((sum, n) => sum + (n.vlrInss ?? 0), 0);
  }, [notasFiltradas]);

  const totalRetencoes = useMemo(() => totalCsll + totalIrrf + totalInss, [totalCsll, totalIrrf, totalInss]);

  const resultadoOperacional = useMemo(() => receitaLiquida - totalRetencoes, [receitaLiquida, totalRetencoes]);

  const handlePrint = () => {
    window.print();
  };

  const selectedCompanyName = useMemo(() => {
    if (empresaFiltro === "__all__") return "Todas as Empresas";
    const found = empresas.find((e) => e.cnpj === empresaFiltro);
    return found ? found.nome : empresaFiltro;
  }, [empresaFiltro, empresas]);

  const periodoInicioLabel = useMemo(() => {
    const found = mesesOpcoes.find((m) => m.value === mesInicio);
    return `${found ? found.label.slice(0, 3) : mesInicio}/${anoInicio}`;
  }, [mesInicio, anoInicio]);

  const periodoFimLabel = useMemo(() => {
    const found = mesesOpcoes.find((m) => m.value === mesFim);
    return `${found ? found.label.slice(0, 3) : mesFim}/${anoFim}`;
  }, [mesFim, anoFim]);

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1000px] w-full mx-auto space-y-6">
      {/* Inline styles for clean printing layout */}
      <style>{`
        @media print {
          aside, 
          header, 
          .no-print,
          .px-6.pt-4 {
            display: none !important;
          }
          
          body, html, main, .flex-1 {
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }

          main {
            padding: 1.5cm !important;
          }

          .print-border {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
          }

          .print-bg-gray {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Header (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs mb-2 transition-colors">
            <Link to="/" className="flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Cockpit
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-indigo-600" />
            Relatório DRE Estimado
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Demonstração de Resultado do Exercício simplificada com base em NFS-e válidas</p>
        </div>
        <Button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 h-9 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:scale-[1.01] transition-all duration-350"
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      {/* Filter Panel (Hidden in Print) */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs no-print space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtros do Relatório</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Empresa Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Empresa Prestadora</label>
            <Select value={empresaFiltro} onValueChange={(val) => updateFilters({ empresa: val })}>
              <SelectTrigger className="w-full h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
                <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                <SelectValue placeholder="Empresa Prestadora" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__all__">Todas as Empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período Inicial */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Período Inicial</label>
            <div className="flex gap-2">
              <Select value={mesInicio} onValueChange={(val) => updateFilters({ mesInicio: val })}>
                <SelectTrigger className="flex-1 h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {mesesOpcoes.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anoInicio} onValueChange={(val) => updateFilters({ anoInicio: val })}>
                <SelectTrigger className="w-24 h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Período Final */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Período Final</label>
            <div className="flex gap-2">
              <Select value={mesFim} onValueChange={(val) => updateFilters({ mesFim: val })}>
                <SelectTrigger className="flex-1 h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {mesesOpcoes.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anoFim} onValueChange={(val) => updateFilters({ anoFim: val })}>
                <SelectTrigger className="w-24 h-9 text-xs rounded-xl bg-muted border-border cursor-pointer">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* DRE Printable Sheet */}
      <div className="bg-card border border-border rounded-2xl shadow-xs print-border overflow-hidden">
        {/* Header Block of DRE */}
        <div className="p-6 md:p-8 border-b border-border/80 print-bg-gray flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground uppercase">Demonstração do Resultado do Exercício (DRE)</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-semibold">Regime: {periodType === "competencia" ? "Competência" : "Emissão"} (Estimado Simplificado · Notas Fiscais Emitidas)</p>
          </div>
          <div className="text-left md:text-right text-[11px] font-medium text-muted-foreground space-y-0.5">
            <div><span className="font-semibold text-foreground">Empresa:</span> {selectedCompanyName}</div>
            <div><span className="font-semibold text-foreground">Período:</span> de {periodoInicioLabel} até {periodoFimLabel}</div>
            <div className="no-print"><span className="font-semibold text-foreground">Notas Consolidadas:</span> {notasFiltradas.length} documentos</div>
          </div>
        </div>

        {/* DRE Structure Table */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-3">
            {/* 1. Receita Bruta */}
            <div className="flex items-center justify-between py-2 border-b border-border/80 text-sm">
              <span className="font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-indigo-500 shrink-0" />
                (+) RECEITA BRUTA DE SERVIÇOS
              </span>
              <span className="font-bold text-foreground font-mono text-base">{fmtBRL(receitaBruta)}</span>
            </div>

            {/* 2. Deduções (sub-itens) */}
            <div className="pl-6 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>(-) Imposto Sobre Serviços (ISS)</span>
                <span className="font-mono">{fmtBRL(totalIss)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>(-) Programação de Integração Social (PIS)</span>
                <span className="font-mono">{fmtBRL(totalPis)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>(-) Contribuição p/ Financiamento da Seguridade (COFINS)</span>
                <span className="font-mono">{fmtBRL(totalCofins)}</span>
              </div>
            </div>

            {/* Total Deduções Summary */}
            <div className="flex items-center justify-between py-1.5 border-b border-border/50 text-xs font-semibold text-muted-foreground">
              <span>(-) TOTAL DEDUÇÕES DA RECEITA BRUTA</span>
              <span className="font-mono text-rose-500">-{fmtBRL(totalDeducoes)}</span>
            </div>

            {/* 3. Receita Líquida */}
            <div className="flex items-center justify-between py-2 border-b border-border/85 text-sm bg-muted/30 px-3.5 rounded-lg my-1.5 print-bg-gray">
              <span className="font-extrabold text-foreground uppercase">(=) RECEITA LÍQUIDA</span>
              <span className="font-extrabold text-foreground font-mono">{fmtBRL(receitaLiquida)}</span>
            </div>

            {/* 4. Retenções na Fonte (sub-itens) */}
            <div className="pl-6 space-y-1.5 text-xs text-muted-foreground mt-2">
              <div className="flex items-center justify-between">
                <span>(-) Contribuição Social sobre Lucro Líquido (CSLL)</span>
                <span className="font-mono">{fmtBRL(totalCsll)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>(-) Imposto de Renda Retido na Fonte (IRRF)</span>
                <span className="font-mono">{fmtBRL(totalIrrf)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>(-) Contribuição Previdenciária (INSS)</span>
                <span className="font-mono">{fmtBRL(totalInss)}</span>
              </div>
            </div>

            {/* Total Retenções Summary */}
            <div className="flex items-center justify-between py-1.5 border-b border-border/50 text-xs font-semibold text-muted-foreground">
              <span>(-) TOTAL RETENÇÕES NA FONTE</span>
              <span className="font-mono text-rose-500">-{fmtBRL(totalRetencoes)}</span>
            </div>

            {/* 5. Resultado Operacional */}
            <div className="flex items-center justify-between py-3 border border-emerald-500/25 bg-emerald-500/5 px-4 rounded-xl mt-4 text-emerald-950 dark:text-emerald-300">
              <span className="font-extrabold uppercase text-xs tracking-wide">(=) RESULTADO OPERACIONAL ESTIMADO</span>
              <span className="font-extrabold font-mono text-base">{fmtBRL(resultadoOperacional)}</span>
            </div>
          </div>

          {/* Audit disclaimer */}
          <div className="text-[9px] text-muted-foreground leading-relaxed text-center mt-8 pt-4 border-t border-border/50">
            * Nota: A DRE apresentada baseia-se exclusivamente no faturamento das NFS-e emitidas de status "válida".
            Esta demonstração é provisória e estimada para fins analíticos de BI e não substitui a apuração contábil legal.
          </div>
        </div>
      </div>

      <footer className="text-center text-[10px] text-muted-foreground pt-4 border-t border-border/80 no-print">
        🔒 Processamento 100% Client-Side local — Seus dados contábeis permanecem seguros no seu navegador.
      </footer>
    </main>
  );
}
