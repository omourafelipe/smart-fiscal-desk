import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FiscalDocument, type TaxRule, type RuleType } from "@/lib/db";
import { recalculateAllClassifications } from "@/lib/fiscal/rulesEngine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Plus, Edit, Trash2, Tag, LayoutDashboard, Settings2, Sparkles,
  AlertTriangle, CheckCircle, Search, HelpCircle, Coins, Info
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/classificacao")({
  component: ClassificacaoPage,
});

/* ─── Formatadores e Helpers ─── */
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCnpj = (v: string) => {
  const c = (v || "").replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v || "—";
};

const fmtCompet = (v: string) => {
  if (!v) return "—";
  const [a, m] = v.split("-");
  return a && m ? `${m}/${a}` : v;
};

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

const LABELS_TIPO: Record<RuleType, string> = {
  cliente: "Cliente/Tomador",
  palavra_chave: "Palavra-chave",
  codigo_exato: "Código Tributário Exato",
  faixa_codigo: "Faixa de Códigos",
  municipio: "Município",
  padrao: "Regra Padrão",
};

function ClassificacaoPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const rules = useLiveQuery(() => db.taxRules.toArray(), []);

  // Roteamento interno por abas
  const [activeTab, setActiveTab] = useState<"dashboard" | "regras" | "pendentes">("dashboard");

  // Estados de Busca / Filtros
  const [buscaSemClassif, setBuscaSemClassif] = useState("");
  const [loadingRecalc, setLoadingRecalc] = useState(false);

  // Estados do CRUD de Regras
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<RuleType>("cliente");
  const [valorCliente, setValorCliente] = useState("");
  const [valorPalavraChave, setValorPalavraChave] = useState("");
  const [valorCodigoExato, setValorCodigoExato] = useState("");
  const [valorFaixaInicio, setValorFaixaInicio] = useState("");
  const [valorFaixaFim, setValorFaixaFim] = useState("");
  const [valorMunicipio, setValorMunicipio] = useState("");

  const [categoria, setCategoria] = useState("");
  const [grupo, setGrupo] = useState("");
  const [centroReceita, setCentroReceita] = useState("");
  const [subcategoria, setSubcategoria] = useState("");

  // Ativos e pendentes
  const docsAtivos = useMemo(() => (docs ?? []).filter((d) => d.status_manual === "Ativo"), [docs]);
  const semClassificacao = useMemo(() => docsAtivos.filter((d) => !d.categoria), [docsAtivos]);

  // Lista de pendentes filtrada
  const semClassificacaoFiltrada = useMemo(() => {
    if (!buscaSemClassif.trim()) return semClassificacao;
    const q = buscaSemClassif.toLowerCase().trim();
    return semClassificacao.filter(
      (d) =>
        d.id_nota.toLowerCase().includes(q) ||
        (d.nome_tomador || "").toLowerCase().includes(q) ||
        (d.nome_prestador || "").toLowerCase().includes(q) ||
        (d.descricao_servico || "").toLowerCase().includes(q) ||
        (d.codigo_servico || "").toLowerCase().includes(q) ||
        (d.municipio || "").toLowerCase().includes(q)
    );
  }, [semClassificacao, buscaSemClassif]);

  // Limpa formulário de Regra
  const resetForm = () => {
    setEditingRuleId(null);
    setNome("");
    setTipo("cliente");
    setValorCliente("");
    setValorPalavraChave("");
    setValorCodigoExato("");
    setValorFaixaInicio("");
    setValorFaixaFim("");
    setValorMunicipio("");
    setCategoria("");
    setGrupo("");
    setCentroReceita("");
    setSubcategoria("");
  };

  // Preenche formulário para criar regra baseada em uma nota (Aprendizado Assistido)
  const prefillFromDoc = (doc: FiscalDocument) => {
    resetForm();
    setNome(`Regra para ${doc.nome_tomador || doc.cnpj_tomador}`);
    
    // Escolhe sugestão padrão baseada no que está disponível na nota
    if (doc.cnpj_tomador) {
      setTipo("cliente");
      setValorCliente(doc.cnpj_tomador);
    } else if (doc.descricao_servico) {
      setTipo("palavra_chave");
      setValorPalavraChave(doc.descricao_servico.split(" ")[0]);
    } else if (doc.codigo_servico || doc.item_lista_servico) {
      setTipo("codigo_exato");
      setValorCodigoExato(doc.codigo_servico || doc.item_lista_servico || "");
    }

    if (doc.municipio) {
      setValorMunicipio(doc.municipio);
    }

    setActiveTab("regras");
    toast.info("Formulário pré-preenchido com dados da nota. Defina as classificações gerenciais!");
  };

  // Preenche formulário para edição de regra existente
  const handleEditRule = (rule: TaxRule) => {
    resetForm();
    setEditingRuleId(rule.id || null);
    setNome(rule.nome);
    setTipo(rule.tipo);
    setValorCliente(rule.valor_cliente || "");
    setValorPalavraChave(rule.valor_palavra_chave || "");
    setValorCodigoExato(rule.valor_codigo_exato || "");
    setValorFaixaInicio(rule.valor_faixa_inicio || "");
    setValorFaixaFim(rule.valor_faixa_fim || "");
    setValorMunicipio(rule.valor_municipio || "");
    setCategoria(rule.categoria);
    setGrupo(rule.grupo);
    setCentroReceita(rule.centro_receita);
    setSubcategoria(rule.subcategoria);
  };

  // Salva / Atualiza Regra
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !categoria.trim() || !grupo.trim() || !centroReceita.trim() || !subcategoria.trim()) {
      toast.error("Preencha o nome da regra e todos os campos gerenciais.");
      return;
    }

    // Validações básicas de condicional
    if (tipo === "cliente" && !valorCliente.trim()) {
      toast.error("Insira o CNPJ ou Nome do Cliente.");
      return;
    }
    if (tipo === "palavra_chave" && !valorPalavraChave.trim()) {
      toast.error("Insira a palavra-chave.");
      return;
    }
    if (tipo === "codigo_exato" && !valorCodigoExato.trim()) {
      toast.error("Insira o código municipal ou LC 116.");
      return;
    }
    if (tipo === "faixa_codigo" && (!valorFaixaInicio.trim() || !valorFaixaFim.trim())) {
      toast.error("Insira os códigos inicial e final da faixa.");
      return;
    }
    if (tipo === "municipio" && !valorMunicipio.trim()) {
      toast.error("Insira o nome ou código do município.");
      return;
    }

    setLoadingRecalc(true);
    try {
      const ruleData: TaxRule = {
        nome: nome.trim(),
        tipo,
        valor_cliente: tipo === "cliente" ? valorCliente.trim() : undefined,
        valor_palavra_chave: tipo === "palavra_chave" ? valorPalavraChave.trim() : undefined,
        valor_codigo_exato: tipo === "codigo_exato" ? valorCodigoExato.trim() : undefined,
        valor_faixa_inicio: tipo === "faixa_codigo" ? valorFaixaInicio.trim() : undefined,
        valor_faixa_fim: tipo === "faixa_codigo" ? valorFaixaFim.trim() : undefined,
        valor_municipio: tipo === "municipio" ? valorMunicipio.trim() : undefined,
        categoria: categoria.trim(),
        grupo: grupo.trim(),
        centro_receita: centroReceita.trim(),
        subcategoria: subcategoria.trim(),
      };

      if (editingRuleId !== null) {
        ruleData.id = editingRuleId;
      }

      await db.taxRules.put(ruleData);
      
      // Força o recalculamento de todas as classificações automaticamente
      await recalculateAllClassifications();
      
      toast.success(editingRuleId ? "Regra atualizada e notas reprocessadas!" : "Nova regra cadastrada e notas classificadas!");
      resetForm();
    } catch (err: any) {
      toast.error(`Erro ao salvar regra: ${err.message || err}`);
    } finally {
      setLoadingRecalc(false);
    }
  };

  // Exclui Regra
  const handleDeleteRule = async (id: number) => {
    if (!confirm("Tem certeza de que deseja remover esta regra de classificação? Todas as notas serão reclassificadas.")) return;
    setLoadingRecalc(true);
    try {
      await db.taxRules.delete(id);
      await recalculateAllClassifications();
      toast.success("Regra removida e notas reprocessadas!");
    } catch (err: any) {
      toast.error(`Erro ao remover regra: ${err.message || err}`);
    } finally {
      setLoadingRecalc(false);
    }
  };

  // Recalculo Geral Manual
  const handleRecalculateAll = async () => {
    setLoadingRecalc(true);
    try {
      await recalculateAllClassifications();
      toast.success("Reprocessamento completo finalizado com sucesso!");
    } catch (err: any) {
      toast.error(`Erro no reprocessamento: ${err.message || err}`);
    } finally {
      setLoadingRecalc(false);
    }
  };

  // --- CÁLCULO DE MÉTRICAS DO DASHBOARD GERENCIAL ---
  const kpis = useMemo(() => {
    let brutoClassif = 0;
    let retidoClassif = 0;
    
    docsAtivos.forEach((d) => {
      if (d.categoria) {
        brutoClassif += d.valor_bruto;
        retidoClassif += d.valor_retido;
      }
    });

    const aliqEfetiva = brutoClassif > 0 ? (retidoClassif / brutoClassif) * 100 : 0;

    return {
      brutoClassif,
      retidoClassif,
      aliqEfetiva,
      totalNotas: docsAtivos.length,
      classificadas: docsAtivos.length - semClassificacao.length,
    };
  }, [docsAtivos, semClassificacao]);

  // 1. Receita por Categoria
  const receitaPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    docsAtivos.forEach((d) => {
      const cat = d.categoria || "Não Classificado";
      map[cat] = (map[cat] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [docsAtivos]);

  // 2. Receita por Grupo
  const receitaPorGrupo = useMemo(() => {
    const map: Record<string, number> = {};
    docsAtivos.forEach((d) => {
      const grp = d.grupo || "Não Classificado";
      map[grp] = (map[grp] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [docsAtivos]);

  // 3. Receita por Centro de Receita
  const receitaPorCentro = useMemo(() => {
    const map: Record<string, number> = {};
    docsAtivos.forEach((d) => {
      const cr = d.centro_receita || "Não Classificado";
      map[cr] = (map[cr] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [docsAtivos]);

  // 4. Receita por Subcategoria
  const receitaPorSubcategoria = useMemo(() => {
    const map: Record<string, number> = {};
    docsAtivos.forEach((d) => {
      const sub = d.subcategoria || "Não Classificado";
      map[sub] = (map[sub] || 0) + d.valor_bruto;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [docsAtivos]);

  // 5. Retenção por Categoria
  const retencaoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    docsAtivos.forEach((d) => {
      const cat = d.categoria || "Não Classificado";
      map[cat] = (map[cat] || 0) + d.valor_retido;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [docsAtivos]);

  // 6. Retenção por Cliente (Top 10)
  const retencaoPorCliente = useMemo(() => {
    const map: Record<string, { nome: string; retido: number }> = {};
    docsAtivos.forEach((d) => {
      const key = d.cnpj_tomador || "Desconhecido";
      if (!map[key]) {
        map[key] = {
          nome: d.nome_tomador || fmtCnpj(key),
          retido: 0,
        };
      }
      map[key].retido += d.valor_retido;
    });
    return Object.values(map)
      .sort((a, b) => b.retido - a.retido)
      .slice(0, 10)
      .map((item) => ({ name: item.nome, value: item.retido }));
  }, [docsAtivos]);

  // 7. Alíquota Efetiva por Categoria
  const aliquotaEfetivaPorCategoria = useMemo(() => {
    const brutoMap: Record<string, number> = {};
    const retidoMap: Record<string, number> = {};

    docsAtivos.forEach((d) => {
      const cat = d.categoria;
      if (!cat) return; // ignorar não classificados para esta análise
      brutoMap[cat] = (brutoMap[cat] || 0) + d.valor_bruto;
      retidoMap[cat] = (retidoMap[cat] || 0) + d.valor_retido;
    });

    return Object.keys(brutoMap).map((cat) => {
      const bruto = brutoMap[cat];
      const retido = retidoMap[cat];
      const rate = bruto > 0 ? (retido / bruto) * 100 : 0;
      return {
        name: cat,
        aliquota: Number(rate.toFixed(2)),
      };
    });
  }, [docsAtivos]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto min-h-screen">
      
      {/* Header da Página */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Classificação Gerencial & Regras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o motor de prioridades tributárias para automatizar suas classificações de custos e receitas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateAll}
            disabled={loadingRecalc || (docs ?? []).length === 0}
            className="text-xs h-9"
          >
            {loadingRecalc ? "Processando..." : "Forçar Reprocessamento Geral"}
          </Button>
        </div>
      </div>

      {/* Alerta Resumo de Classificação */}
      {semClassificacao.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Notas Pendentes de Classificação</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Existem <strong>{semClassificacao.length}</strong> notas fiscais ativas que não foram categorizadas por nenhuma regra.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveTab("pendentes")}
            className="text-[11px] h-8 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border-0"
          >
            <Sparkles className="h-3 w-3 mr-1.5" />
            Classificar Notas Pendentes
          </Button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-border text-sm">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 font-medium flex items-center gap-1.5 transition-colors border-b-2 -mb-[2px] ${
            activeTab === "dashboard"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard Gerencial
        </button>
        <button
          onClick={() => setActiveTab("regras")}
          className={`px-4 py-2 font-medium flex items-center gap-1.5 transition-colors border-b-2 -mb-[2px] ${
            activeTab === "regras"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag className="h-4 w-4" />
          Regras Tributárias ({rules?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab("pendentes")}
          className={`px-4 py-2 font-medium flex items-center gap-1.5 transition-colors border-b-2 -mb-[2px] ${
            activeTab === "pendentes"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Aprendizado Assistido
          {semClassificacao.length > 0 && (
            <Badge className="ml-1 bg-amber-500 hover:bg-amber-500 text-white font-mono text-[9px] px-1.5 h-4 flex items-center">
              {semClassificacao.length}
            </Badge>
          )}
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="space-y-6">
        
        {/* ── ABA 1: DASHBOARD GERENCIAL ── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Faturamento Classificado</span>
                <div className="text-xl font-bold text-foreground font-mono">{fmtBRL(kpis.brutoClassif)}</div>
                <span className="text-[10px] text-muted-foreground block">Base ativa com classificação gerencial</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Retenção Classificada</span>
                <div className="text-xl font-bold text-foreground font-mono">{fmtBRL(kpis.retidoClassif)}</div>
                <span className="text-[10px] text-muted-foreground block">Impostos retidos das notas classificadas</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Alíquota Efetiva Média</span>
                <div className="text-xl font-bold text-primary font-mono">{kpis.aliqEfetiva.toFixed(2)}%</div>
                <span className="text-[10px] text-muted-foreground block">Proporção retenção/bruto das notas</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Notas Mapeadas</span>
                <div className="text-xl font-bold text-foreground font-mono">
                  {kpis.classificadas} / {kpis.totalNotas}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  {kpis.totalNotas > 0 ? ((kpis.classificadas / kpis.totalNotas) * 100).toFixed(1) : 0}% de cobertura
                </span>
              </div>
            </div>

            {(docsAtivos ?? []).length === 0 ? (
              <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm">Nenhum dado ativo para exibir no Dashboard. Importe notas fiscais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Receita por Categoria */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita por Categoria</h3>
                    <Badge variant="outline" className="text-[10px]">Bruto</Badge>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={receitaPorCategoria} layout="vertical" margin={{ left: 20, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                        <XAxis type="number" fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" width={80} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill={C.blue} radius={[0, 4, 4, 0]}>
                          {receitaPorCategoria.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Receita por Grupo */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita por Grupo</h3>
                    <Badge variant="outline" className="text-[10px]">Bruto</Badge>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={receitaPorGrupo} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" />
                        <YAxis fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill={C.purple} radius={[4, 4, 0, 0]}>
                          {receitaPorGrupo.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[(index + 2) % PALETA.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Receita por Centro de Receita */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita por Centro de Receita</h3>
                    <Badge variant="outline" className="text-[10px]">Bruto</Badge>
                  </div>
                  <div className="h-64 flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={receitaPorCentro}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {receitaPorCentro.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[(index + 4) % PALETA.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Receita por Subcategoria */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receita por Subcategoria</h3>
                    <Badge variant="outline" className="text-[10px]">Bruto</Badge>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={receitaPorSubcategoria} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" />
                        <YAxis fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill={C.teal} radius={[4, 4, 0, 0]}>
                          {receitaPorSubcategoria.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[(index + 1) % PALETA.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Retenção por Categoria */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retenção por Categoria</h3>
                    <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-500 border-rose-500/20">Retido</Badge>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={retencaoPorCategoria} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" />
                        <YAxis fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill={C.orange} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Retenção por Cliente (Top 10) */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retenção por Cliente (Top 10)</h3>
                    <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-500 border-rose-500/20">Retido</Badge>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={retencaoPorCliente} layout="vertical" margin={{ left: 30, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                        <XAxis type="number" fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" width={100} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill="#E11D48" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Alíquota Efetiva por Categoria */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alíquota Efetiva por Categoria (%)</h3>
                    <Badge variant="outline" className="text-[10px]">Porcentagem</Badge>
                  </div>
                  {aliquotaEfetivaPorCategoria.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                      Insira regras de classificação para analisar as alíquotas efetivas.
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aliquotaEfetivaPorCategoria} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                          <XAxis dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" />
                          <YAxis fontSize={10} stroke="var(--color-muted-foreground)" unit="%" />
                          <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                          <Bar dataKey="aliquota" fill={C.green} radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: "var(--color-foreground)", formatter: (v: any) => `${v}%` }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── ABA 2: REGRAS TRIBUTÁRIAS ── */}
        {activeTab === "regras" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulário de Criação/Edição */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 h-fit">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                {editingRuleId ? <Edit className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                {editingRuleId ? "Editar Regra" : "Nova Regra de Classificação"}
              </h3>
              
              <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
                
                {/* Nome da Regra */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Nome da Regra</label>
                  <Input
                    placeholder="Ex: Plano de Saúde Bradesco"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>

                {/* Tipo de Regra */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Classificar por (Critério)</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as RuleType)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="cliente">Cliente/Tomador (CNPJ ou Nome)</option>
                    <option value="palavra_chave">Palavra-chave na Descrição</option>
                    <option value="codigo_exato">Código Tributário Exato (Municipal/LC116)</option>
                    <option value="faixa_codigo">Faixa de Códigos Tributários</option>
                    <option value="municipio">Município</option>
                    <option value="padrao">Regra Padrão (Fallback)</option>
                  </select>
                </div>

                {/* Condicional Baseado no Tipo */}
                {tipo === "cliente" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="font-medium text-muted-foreground">CNPJ ou Parte do Nome do Cliente</label>
                    <Input
                      placeholder="Insira CNPJ ou termo de busca"
                      value={valorCliente}
                      onChange={(e) => setValorCliente(e.target.value)}
                      required
                    />
                  </div>
                )}

                {tipo === "palavra_chave" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="font-medium text-muted-foreground">Palavra-chave na Descrição do Serviço</label>
                    <Input
                      placeholder="Ex: consultoria, software, locacao"
                      value={valorPalavraChave}
                      onChange={(e) => setValorPalavraChave(e.target.value)}
                      required
                    />
                  </div>
                )}

                {tipo === "codigo_exato" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="font-medium text-muted-foreground">Código Tributário Exato</label>
                    <Input
                      placeholder="Ex: 01.01 ou 1003"
                      value={valorCodigoExato}
                      onChange={(e) => setValorCodigoExato(e.target.value)}
                      required
                    />
                  </div>
                )}

                {tipo === "faixa_codigo" && (
                  <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <label className="font-medium text-muted-foreground">Cód. Inicial</label>
                      <Input
                        placeholder="Ex: 01.01"
                        value={valorFaixaInicio}
                        onChange={(e) => setValorFaixaInicio(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-muted-foreground">Cód. Final</label>
                      <Input
                        placeholder="Ex: 01.09"
                        value={valorFaixaFim}
                        onChange={(e) => setValorFaixaFim(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {tipo === "municipio" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="font-medium text-muted-foreground">Município (Nome ou Código IBGE)</label>
                    <Input
                      placeholder="Ex: Sao Paulo ou 3550308"
                      value={valorMunicipio}
                      onChange={(e) => setValorMunicipio(e.target.value)}
                      required
                    />
                  </div>
                )}

                {tipo === "padrao" && (
                  <div className="p-3 bg-muted/50 rounded-lg text-[11px] text-muted-foreground flex gap-1.5 animate-in fade-in duration-200">
                    <Info className="h-4 w-4 shrink-0 text-primary" />
                    <span>Esta regra será aplicada caso nenhuma outra regra de prioridade superior corresponda à nota fiscal.</span>
                  </div>
                )}

                <hr className="border-border my-2" />
                <h4 className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Classificações Geradas</h4>

                {/* Categoria */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Categoria</label>
                  <Input
                    placeholder="Ex: Tecnologia, Plano de Saúde, Aluguel"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    required
                  />
                </div>

                {/* Grupo */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Grupo</label>
                  <Input
                    placeholder="Ex: Infraestrutura, Saúde Suplementar, Opex"
                    value={grupo}
                    onChange={(e) => setGrupo(e.target.value)}
                    required
                  />
                </div>

                {/* Centro de Receita */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Centro de Receita</label>
                  <Input
                    placeholder="Ex: Diretoria TI, Convênios, Administrativo"
                    value={centroReceita}
                    onChange={(e) => setCentroReceita(e.target.value)}
                    required
                  />
                </div>

                {/* Subcategoria */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Subcategoria</label>
                  <Input
                    placeholder="Ex: Licenciamento, Coparticipação, Predial"
                    value={subcategoria}
                    onChange={(e) => setSubcategoria(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={loadingRecalc}>
                    {editingRuleId ? "Atualizar Regra" : "Criar Regra"}
                  </Button>
                  {editingRuleId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                  )}
                </div>

              </form>
            </div>

            {/* Listagem de Regras Cadastradas */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Regras Cadastradas</h3>
                <span className="text-xs text-muted-foreground">{rules?.length ?? 0} regra(s) ativa(s)</span>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Prioridade</TableHead>
                      <TableHead>Nome / Critério</TableHead>
                      <TableHead>Condição de Entrada</TableHead>
                      <TableHead>Classificação Gerada</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rules ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-10">
                          <Info className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                          Nenhuma regra cadastrada. Adicione regras ao lado ou pelo Assistente para classificar suas notas fiscais.
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...(rules ?? [])].sort((a, b) => {
                        // Ordena pelo critério de precedência no display também
                        const priorityList: Record<RuleType, number> = {
                          cliente: 1, palavra_chave: 2, codigo_exato: 3, faixa_codigo: 4, municipio: 5, padrao: 6
                        };
                        const pA = priorityList[a.tipo] || 99;
                        const pB = priorityList[b.tipo] || 99;
                        if (pA !== pB) return pA - pB;
                        return (b.id || 0) - (a.id || 0);
                      }).map((rule, idx) => {
                        return (
                          <TableRow key={rule.id}>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center p-0 mx-auto">
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-semibold">{rule.nome}</div>
                              <div className="text-[10px] text-muted-foreground">{LABELS_TIPO[rule.tipo]}</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {rule.tipo === "cliente" && `Tomador: "${rule.valor_cliente}"`}
                              {rule.tipo === "palavra_chave" && `Discriminação contém: "${rule.valor_palavra_chave}"`}
                              {rule.tipo === "codigo_exato" && `Código: "${rule.valor_codigo_exato}"`}
                              {rule.tipo === "faixa_codigo" && `Código entre: [${rule.valor_faixa_inicio} e ${rule.valor_faixa_fim}]`}
                              {rule.tipo === "municipio" && `Município: "${rule.valor_municipio}"`}
                              {rule.tipo === "padrao" && "Qualquer nota (Fallback)"}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="grid grid-cols-2 gap-x-2 text-[10px] leading-tight">
                                <div><span className="text-muted-foreground">Cat:</span> {rule.categoria}</div>
                                <div><span className="text-muted-foreground">Grupo:</span> {rule.grupo}</div>
                                <div><span className="text-muted-foreground">CR:</span> {rule.centro_receita}</div>
                                <div><span className="text-muted-foreground">Sub:</span> {rule.subcategoria}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditRule(rule)}>
                                  <Edit className="h-3.5 w-3.5 text-primary" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDeleteRule(rule.id!)}>
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>
        )}

        {/* ── ABA 3: APRENDIZADO ASSISTIDO / PENDENTES ── */}
        {activeTab === "pendentes" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm">Notas Fiscais Sem Classificação</h3>
                <p className="text-xs text-muted-foreground">
                  Estas notas não corresponderam a nenhuma regra. Clique em <strong>Criar Regra</strong> para automatizar futuras notas semelhantes.
                </p>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar notas..."
                  value={buscaSemClassif}
                  onChange={(e) => setBuscaSemClassif(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>ID da Nota</TableHead>
                    <TableHead>Prestador / Tomador</TableHead>
                    <TableHead>Serviço / Cód. Municipal</TableHead>
                    <TableHead>Descrição / Discriminação</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semClassificacaoFiltrada.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-10">
                        {semClassificacao.length === 0 ? (
                          <div className="space-y-1">
                            <CheckCircle className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
                            <div className="font-semibold text-foreground">Tudo classificado!</div>
                            <div>Todas as notas ativas foram mapeadas por suas regras tributárias.</div>
                          </div>
                        ) : (
                          "Nenhuma nota pendente corresponde à busca."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    semClassificacaoFiltrada.map((doc) => (
                      <TableRow key={doc.id_nota}>
                        <TableCell className="text-[10px] font-mono">{fmtCompet(doc.data_competencia)}</TableCell>
                        <TableCell className="text-[10px] font-mono truncate max-w-[120px]" title={doc.id_nota}>
                          {doc.id_nota}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium truncate max-w-[150px]" title={doc.nome_tomador}>
                            <span className="text-muted-foreground">T:</span> {doc.nome_tomador || "—"}
                          </div>
                          <div className="text-muted-foreground text-[10px] truncate max-w-[150px]" title={doc.nome_prestador}>
                            <span className="text-muted-foreground">P:</span> {doc.nome_prestador || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div>LC116: {doc.item_lista_servico || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">Mun: {doc.codigo_servico || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground" title={doc.descricao_servico}>
                          {doc.descricao_servico || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{doc.municipio || "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium">{fmtBRL(doc.valor_bruto)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => prefillFromDoc(doc)}
                            className="h-7 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border-0"
                          >
                            Criar Regra
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
