import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type StatusManual, type FiscalDocument, type CategoriaOrigem } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search, AlertCircle, X, FileCode, CheckCircle, Calculator,
  Building2, Users, Landmark, FileText, ChevronRight, Zap, ShieldCheck, HelpCircle,
  FileSpreadsheet, ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { GlobalFilters } from "@/components/GlobalFilters";
import { useFiscalStore } from "@/store/useFiscalStore";

export const Route = createFileRoute("/notas")({
  component: NotasPage,
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

const fmtCompet = (v: string) => {
  if (!v) return "—";
  const [a, m] = v.split("-");
  return a && m ? `${m}/${a}` : v;
};

function origemBadge(origem?: CategoriaOrigem) {
  switch (origem) {
    case 'CODIGO_TRIBUTARIO':
      return { label: 'Código Tributário', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300', title: 'Mapeamento Oficial por Código Tributário' };
    case 'LC116':
      return { label: 'Código LC 116', className: 'bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-300', title: 'Mapeamento Oficial por LC 116' };
    case 'NBS':
      return { label: 'NBS', className: 'bg-violet-500/15 text-violet-700 border-violet-500/25 dark:text-violet-300', title: 'Similaridade por NBS' };
    case 'HEURISTICA':
      return { label: 'Heurística', className: 'bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300', title: 'Heurística por Palavra-chave' };
    default:
      return { label: 'Não Classificado', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400', title: 'Sem mapeamento oficial' };
  }
}

function confiancaColor(v?: number): string {
  if (!v) return 'bg-rose-400';
  if (v >= 95) return 'bg-emerald-500';
  if (v >= 90) return 'bg-blue-500';
  if (v >= 70) return 'bg-amber-400';
  return 'bg-rose-400';
}

const PAGE = 50;

function NotasPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const grupoCnpjs = useLiveQuery(() => db.groupCnpjs.toArray(), []);

  const {
    mesFiltro,
    anoFiltro,
    emissaoMesFiltro,
    emissaoAnoFiltro,
    empresaFiltro,
    statusFiltro,
    operacaoFiltro,
    clienteFiltro,
    municipioFiltro,
    codigoTributarioFiltro,
    tipoServicoFiltro,
    categoriaFiltro,
  } = useFiscalStore();

  const [busca, setBusca] = useState("");
  const [localStatusFiltro, setLocalStatusFiltro] = useState<"todos" | StatusManual>("todos");
  const [page, setPage] = useState(1);
  const [selectedNota, setSelectedNota] = useState<FiscalDocument | null>(null);

  const cnpjGrupoSet = useMemo(
    () => new Set((grupoCnpjs ?? []).map((g) => g.cnpj)),
    [grupoCnpjs]
  );

  const semClassificacaoCount = useMemo(() => {
    return (docs ?? []).filter((d) => d.status_manual === "Ativo" && (!d.tipo_servico || d.tipo_servico === "Outros Serviços")).length;
  }, [docs]);

  // Apply filters including global and local search
  const lista = useMemo(() => {
    let l = docs ?? [];

    // Apply global filters
    l = l.filter((d) => {
      // 1. Competência (Ano / Mês)
      if (anoFiltro) {
        if (!d.data_competencia || d.data_competencia.slice(0, 4) !== anoFiltro) return false;
      }
      if (mesFiltro) {
        if (!d.data_competencia || d.data_competencia.split("-")[1] !== mesFiltro) return false;
      }

      // 2. Período de Emissão (Ano / Mês)
      if (emissaoAnoFiltro) {
        if (!d.data_emissao || d.data_emissao.slice(0, 4) !== emissaoAnoFiltro) return false;
      }
      if (emissaoMesFiltro) {
        if (!d.data_emissao || d.data_emissao.split("-")[1] !== emissaoMesFiltro) return false;
      }

      // 3. Outros Filtros
      if (empresaFiltro && d.cnpj_prestador !== empresaFiltro) return false;
      if (statusFiltro !== "todos" && d.status_manual !== statusFiltro) return false;

      const isIntercompany = cnpjGrupoSet.has(d.cnpj_prestador) && cnpjGrupoSet.has(d.cnpj_tomador);
      if (operacaoFiltro === "Intercompany" && !isIntercompany) return false;
      if (operacaoFiltro === "Externas" && isIntercompany) return false;

      if (clienteFiltro && (d.nome_tomador || d.cnpj_tomador) !== clienteFiltro) return false;
      if (municipioFiltro && d.municipio !== municipioFiltro) return false;
      
      if (categoriaFiltro) {
        const docCat = d.categoria_sintetica || d.categoria;
        if (docCat !== categoriaFiltro) return false;
      }

      if (tipoServicoFiltro) {
        const docType = d.tipo_servico || d.grupo;
        if (docType !== tipoServicoFiltro) return false;
      }

      if (codigoTributarioFiltro) {
        const code = d.item_lista_servico || d.codigo_servico;
        if (code !== codigoTributarioFiltro) return false;
      }

      return true;
    });

    // Local filters
    if (localStatusFiltro !== "todos") {
      l = l.filter((d) => d.status_manual === localStatusFiltro);
    }

    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      l = l.filter(
        (d) =>
          d.id_nota.toLowerCase().includes(q) ||
          d.cnpj_prestador.includes(q) ||
          d.cnpj_tomador.includes(q) ||
          (d.nome_prestador || "").toLowerCase().includes(q) ||
          (d.nome_tomador || "").toLowerCase().includes(q) ||
          (d.descricao_servico || "").toLowerCase().includes(q) ||
          (d.tipo_servico || "").toLowerCase().includes(q)
      );
    }

    return [...l].sort((a, b) => (b.data_competencia || "").localeCompare(a.data_competencia || ""));
  }, [docs, busca, localStatusFiltro, anoFiltro, mesFiltro, emissaoAnoFiltro, emissaoMesFiltro, empresaFiltro, statusFiltro, operacaoFiltro, clienteFiltro, municipioFiltro, categoriaFiltro, tipoServicoFiltro, codigoTributarioFiltro, cnpjGrupoSet]);

  const totalPages = Math.max(1, Math.ceil(lista.length / PAGE));
  const pageSafe = Math.min(page, totalPages);
  const slice = lista.slice((pageSafe - 1) * PAGE, pageSafe * PAGE);

  const toggleStatus = async (id_nota: string, current: StatusManual, e: React.MouseEvent) => {
    e.stopPropagation();
    const next: StatusManual = current === "Ativo" ? "Cancelado" : "Ativo";
    await db.documents.update(id_nota, { status_manual: next });
    toast.success(`Nota ${next === "Ativo" ? "reativada" : "marcada como cancelada"}.`);
    if (selectedNota && selectedNota.id_nota === id_nota) {
      setSelectedNota((prev) => prev ? { ...prev, status_manual: next } : null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto min-h-screen relative">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relação Analítica de NFS-e</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Lista geral de notas importadas. Clique em qualquer linha para abrir os detalhes analíticos completos.
        </p>
      </div>

      {semClassificacaoCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Serviços Sem Classificação Automática</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Existem <strong>{semClassificacaoCount}</strong> notas fiscais ativas sem mapeamento específico por regras gerenciais.
              </div>
            </div>
          </div>
          <Link
            to="/classificacao"
            className="inline-flex items-center justify-center rounded-md bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 transition-colors border-0"
          >
            Configurar Regras
          </Link>
        </div>
      )}

      {/* Global Filters */}
      <GlobalFilters />

      {/* Local filters & search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, CNPJ, tomador ou descrição..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <div className="flex rounded-md border border-input bg-card overflow-hidden h-9">
          {(["todos", "Ativo", "Cancelado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setLocalStatusFiltro(s); setPage(1); }}
              className={`px-3 text-xs font-medium border-r last:border-r-0 border-input transition-colors ${
                localStatusFiltro === s
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "todos" ? "Todos" : s}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted-foreground font-semibold">
          {lista.length} nota(s) encontrada(s)
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Competência</TableHead>
              <TableHead className="text-xs">Nº Nota</TableHead>
              <TableHead className="text-xs">Empresa Prestadora</TableHead>
              <TableHead className="text-xs">Cliente Tomador</TableHead>
              <TableHead className="text-xs">Tipo de Serviço</TableHead>
              <TableHead className="text-xs">Categoria Sintética</TableHead>
              <TableHead className="text-xs">Origem</TableHead>
              <TableHead className="text-xs">Confiança</TableHead>
              <TableHead className="text-xs text-right">Valor Bruto</TableHead>
              <TableHead className="text-xs text-right">ISS Retido</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-xs text-muted-foreground py-12">
                  Nenhuma nota encontrada. Altere os filtros ou faça novas importações no Dashboard.
                </TableCell>
              </TableRow>
            ) : (
              slice.map((d) => {
                const docNum = d.id_nota.split("_")[0] || d.id_nota;
                const topServiceType = d.tipo_servico || "Outros Serviços";
                const catSintetica = d.categoria_sintetica || "Outros Serviços";
                return (
                  <TableRow
                    key={d.id_nota}
                    onClick={() => setSelectedNota(d)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="text-xs font-mono">{fmtCompet(d.data_competencia)}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[90px] truncate" title={docNum}>
                      {docNum}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground truncate max-w-[150px]" title={d.nome_prestador}>
                        {d.nome_prestador || "—"}
                      </div>
                      <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_prestador)}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground truncate max-w-[150px]" title={d.nome_tomador}>
                        {d.nome_tomador || "—"}
                      </div>
                      <div className="text-muted-foreground font-mono text-[10px]">{fmtCnpj(d.cnpj_tomador)}</div>
                    </TableCell>
                    {/* Tipo de Serviço */}
                    <TableCell className="text-xs max-w-[140px] truncate">
                      <Badge variant="outline" className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                        {topServiceType}
                      </Badge>
                    </TableCell>
                    {/* Categoria Sintética */}
                    <TableCell className="text-xs max-w-[140px] truncate">
                      <Badge variant="outline" className="text-[9px] font-semibold bg-purple-50 text-purple-700 border-purple-200">
                        {catSintetica}
                      </Badge>
                    </TableCell>
                    {/* Origem */}
                    <TableCell className="text-xs">
                      {(() => {
                        const ob = origemBadge(d.categoria_origem);
                        return (
                          <Badge variant="outline" title={ob.title} className={`text-[9px] font-semibold ${ob.className}`}>
                            {ob.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    {/* Confiança */}
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5" title={`${d.confianca_classificacao ?? 0}%`}>
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${confiancaColor(d.confianca_classificacao)}`}
                            style={{ width: `${d.confianca_classificacao ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{d.confianca_classificacao ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-medium">{fmtBRL(d.valor_bruto)}</TableCell>
                    <TableCell className="text-right text-xs font-mono text-rose-600">{fmtBRL(d.vlr_iss_ret || 0)}</TableCell>
                    <TableCell className="text-center" onClick={(e) => toggleStatus(d.id_nota, d.status_manual, e)}>
                      <Button
                        size="sm"
                        variant={d.status_manual === "Ativo" ? "outline" : "secondary"}
                        className="h-7 text-[10px] font-medium px-2"
                      >
                        {d.status_manual === "Ativo" ? "Ativa" : "Cancelada"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-60" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={pageSafe === 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-muted-foreground">Página {pageSafe} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={pageSafe === totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Slide-over Note Details Panel */}
      {selectedNota && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/40 z-40 transition-opacity backdrop-blur-xs"
            onClick={() => setSelectedNota(null)}
          />

          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l border-border shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold">Detalhamento da NFS-e</h3>
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold block mt-0.5">Nota Fiscal ID: {selectedNota.id_nota}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedNota(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 py-5 space-y-6">
              {/* Status & Action */}
              <div className="flex items-center justify-between gap-3 bg-muted/40 border border-border p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status da Nota</span>
                  <Badge className={`mt-1 text-[9px] px-2 py-0.5 border-0 ${
                    selectedNota.status_manual === "Ativo"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  }`}>
                    {selectedNota.status_manual === "Ativo" ? "Válida / Ativa" : "Cancelada"}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px] font-semibold"
                  onClick={(e) => toggleStatus(selectedNota.id_nota, selectedNota.status_manual, e)}
                >
                  Alternar Status
                </Button>
              </div>

              {/* General Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3">
                  <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Competência</span>
                  <span className="text-xs font-semibold text-foreground block mt-1">{fmtCompet(selectedNota.data_competencia)}</span>
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3">
                  <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Data de Emissão</span>
                  <span className="text-xs font-semibold text-foreground block mt-1 font-mono">
                    {selectedNota.data_emissao ? new Date(selectedNota.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
              </div>

              {/* Prestador & Tomador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-xl p-3.5 space-y-2 bg-card">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-primary" />
                    Empresa Prestadora
                  </span>
                  <div className="text-xs font-bold text-foreground truncate" title={selectedNota.nome_prestador}>
                    {selectedNota.nome_prestador || "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{fmtCnpj(selectedNota.cnpj_prestador)}</div>
                </div>

                <div className="border border-border rounded-xl p-3.5 space-y-2 bg-card">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Users className="h-3 w-3 text-teal-500" />
                    Tomador (Cliente)
                  </span>
                  <div className="text-xs font-bold text-foreground truncate" title={selectedNota.nome_tomador}>
                    {selectedNota.nome_tomador || "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{fmtCnpj(selectedNota.cnpj_tomador)}</div>
                  {selectedNota.municipio && (
                    <div className="text-[9px] text-muted-foreground flex items-center gap-1 font-semibold">
                      <Landmark className="h-3 w-3 text-muted-foreground" />
                      {selectedNota.municipio}
                    </div>
                  )}
                </div>
              </div>

              {/* Mapeamento de Classificação Gerencial */}
              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 block">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Mapeamento de Atividades Econômicas
                </span>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">Tipo de Serviço</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 mt-1 font-bold text-[10px]">
                      {selectedNota.tipo_servico || "Outros Serviços"}
                    </Badge>
                  </div>

                  <div>
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">Categoria Sintética</span>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 mt-1 font-bold text-[10px]">
                      {selectedNota.categoria_sintetica || "Outros Serviços"}
                    </Badge>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">Código & Descrição Tributária</span>
                    <div className="mt-1">
                      <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-[10px]">
                        {selectedNota.item_lista_servico || selectedNota.codigo_servico || "—"}
                      </span>
                      <span className="ml-2 font-medium text-foreground text-[11px] block md:inline mt-1 md:mt-0">
                        {selectedNota.descricao_codigo_tributario || "Sem descrição oficial"}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">NBS (Nomenclatura Brasileira de Serviços)</span>
                    <div className="mt-1 text-[11px] font-medium text-foreground">
                      {selectedNota.codigo_nbs ? (
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] mr-1">{selectedNota.codigo_nbs}</span>
                      ) : null}
                      <span>{selectedNota.descricao_nbs || "Não identificada no XML"}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">Origem da Regra</span>
                    <div className="mt-1">
                      {(() => {
                        const ob = origemBadge(selectedNota.categoria_origem);
                        return (
                          <Badge variant="outline" title={ob.title} className={`text-[10px] font-semibold ${ob.className}`}>
                            {ob.label}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-muted-foreground block font-semibold uppercase">Confiança</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${confiancaColor(selectedNota.confianca_classificacao)}`}
                          style={{ width: `${selectedNota.confianca_classificacao ?? 0}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[10px]">{selectedNota.confianca_classificacao ?? 0}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalhamento Tributário */}
              <div className="border border-border rounded-xl p-4 bg-card space-y-3 shadow-sm">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calculator className="h-3.5 w-3.5 text-rose-500" />
                  Impostos incidentes & retenções
                </span>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "ISS Retido", val: selectedNota.vlr_iss_ret, color: "text-rose-500" },
                    { label: "ISS Próprio", val: selectedNota.iss_proprio || selectedNota.vlr_iss_recolher, color: "text-emerald-600" },
                    { label: "IRRF", val: selectedNota.vlr_irrf, color: "text-rose-500" },
                    { label: "CSLL", val: selectedNota.vlr_csll, color: "text-rose-500" },
                    { label: "PIS", val: selectedNota.vlr_pis, color: "text-rose-500" },
                    { label: "COFINS", val: selectedNota.vlr_cofins, color: "text-rose-500" },
                    { label: "INSS", val: selectedNota.vlr_inss, color: "text-rose-500" },
                    { label: "Total Retido", val: selectedNota.valor_retido, color: "text-rose-600 font-bold" }
                  ].map((tax, idx) => (
                    <div key={idx} className="bg-muted/40 border border-border/40 p-2 rounded-lg">
                      <span className="text-[8px] text-muted-foreground block uppercase font-medium">{tax.label}</span>
                      <span className={`text-[10px] font-mono mt-1 block font-semibold ${tax.color}`}>
                        {tax.val ? fmtBRLCompact(tax.val) : "R$ 0,00"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Faturamento Bruto:</span>
                    <span className="font-semibold text-foreground">{fmtBRL(selectedNota.valor_bruto)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>(-) Deduções Retidas:</span>
                    <span className="font-semibold">-{fmtBRL(selectedNota.valor_retido || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 border-t border-dashed border-border pt-2 text-sm">
                    <span>Faturamento Líquido:</span>
                    <span>{fmtBRL(selectedNota.valor_liquido)}</span>
                  </div>
                </div>
              </div>

              {/* Raw XML */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <FileCode className="h-3.5 w-3.5 text-purple-600" />
                  Arquivo XML Original (Raw)
                </span>
                {selectedNota.raw ? (
                  <pre className="font-mono text-[9px] bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto select-all max-h-40 border border-slate-900 scrollbar-thin">
                    {selectedNota.raw}
                  </pre>
                ) : (
                  <div className="text-xs text-muted-foreground italic bg-muted/40 p-4 rounded-lg text-center border border-dashed border-border">
                    O XML original desta nota não está disponível no banco local.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
