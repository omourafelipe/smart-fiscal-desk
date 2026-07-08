import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type FiscalDocument, type ClassificationRule, TIPO_TO_CATEGORIA_MAP } from "@/lib/db";
import { recalculateAllClassifications, reclassifyAllSintetico } from "@/lib/fiscal/rulesEngine";
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
  AlertTriangle, CheckCircle, Search, Info, Zap, RefreshCw, Layers
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/classificacao")({
  component: ClassificacaoPage,
});

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

const TIPOS_SERVICO = [
  'Plano de Saúde',
  'Serviços Hospitalares',
  'Diagnóstico Laboratorial',
  'Atendimento Médico',
  'Consultoria',
  'Tecnologia',
  'Treinamentos',
  'Locação',
  'Publicidade',
  'Transporte',
  'Engenharia',
  'Construção Civil',
  'Serviços Administrativos',
  'Jurídico',
  'Financeiro',
  'Outros Serviços'
];

const LABELS_TIPO_REGRA: Record<string, string> = {
  codigo_tributario: "Código Tributário",
  descricao_codigo: "Descrição do Código",
  descricao_nbs: "Descrição NBS",
  palavra_chave: "Palavra-chave (Heurística)",
  fallback: "Fallback Padrão",
};

function ClassificacaoPage() {
  const docs = useLiveQuery(() => db.documents.toArray(), []);
  const rules = useLiveQuery(() => db.classificationRules.toArray(), []);

  const [activeTab, setActiveTab] = useState<"dashboard" | "regras" | "pendentes">("dashboard");

  const [buscaSemClassif, setBuscaSemClassif] = useState("");
  const [buscaRegra, setBuscaRegra] = useState("");
  const [loadingRecalc, setLoadingRecalc] = useState(false);
  const [loadingReclassif, setLoadingReclassif] = useState(false);
  const [reclassifProgress, setReclassifProgress] = useState<{ done: number; total: number } | null>(null);
  const [reclassifStats, setReclassifStats] = useState<{
    total: number; codigoTributario: number; lc116: number; nbs: number; heuristica: number; naoClassificado: number;
  } | null>(null);

  // CRUD States
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [tipoRegra, setTipoRegra] = useState<'codigo_tributario' | 'descricao_codigo' | 'descricao_nbs' | 'palavra_chave' | 'fallback'>("codigo_tributario");
  const [padraoBusca, setPadraoBusca] = useState("");
  const [tipoServico, setTipoServico] = useState("Tecnologia");
  const [descricaoRegra, setDescricaoRegra] = useState("");

  const categoriaSintetica = useMemo(() => {
    return TIPO_TO_CATEGORIA_MAP[tipoServico] || "Outros Serviços";
  }, [tipoServico]);

  const docsAtivos = useMemo(() => (docs ?? []).filter((d) => d.status_manual === "Ativo"), [docs]);
  
  // Pendentes: Notas fell back to "Outros Serviços" or missing classification
  const semClassificacao = useMemo(() => {
    return docsAtivos.filter((d) => !d.tipo_servico || d.tipo_servico === "Outros Serviços" || d.categoria_origem === "NAO_CLASSIFICADO");
  }, [docsAtivos]);

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

  const rulesFiltradas = useMemo(() => {
    if (!buscaRegra.trim()) return rules ?? [];
    const q = buscaRegra.toLowerCase().trim();
    return (rules ?? []).filter(
      (r) =>
        r.padrao_busca.toLowerCase().includes(q) ||
        r.tipo_servico.toLowerCase().includes(q) ||
        r.categoria_sintetica.toLowerCase().includes(q) ||
        (r.descricao_regra || "").toLowerCase().includes(q)
    );
  }, [rules, buscaRegra]);

  const resetForm = () => {
    setEditingRuleId(null);
    setTipoRegra("codigo_tributario");
    setPadraoBusca("");
    setTipoServico("Tecnologia");
    setDescricaoRegra("");
  };

  const prefillFromDoc = (doc: FiscalDocument) => {
    resetForm();
    if (doc.item_lista_servico || doc.codigo_servico) {
      setTipoRegra("codigo_tributario");
      setPadraoBusca(doc.item_lista_servico || doc.codigo_servico || "");
    } else if (doc.descricao_servico) {
      setTipoRegra("palavra_chave");
      setPadraoBusca(doc.descricao_servico.split(" ")[0]);
    }
    setDescricaoRegra(`Criada para classificar nota fiscal #${doc.id_nota}`);
    setActiveTab("regras");
    toast.info("Formulário preenchido com dados da nota fiscal!");
  };

  const handleEditRule = (rule: ClassificationRule) => {
    setEditingRuleId(rule.id || null);
    setTipoRegra(rule.tipo_regra);
    setPadraoBusca(rule.padrao_busca);
    setTipoServico(rule.tipo_servico);
    setDescricaoRegra(rule.descricao_regra || "");
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipoRegra !== "fallback" && !padraoBusca.trim()) {
      toast.error("O padrão de busca é obrigatório.");
      return;
    }

    setLoadingRecalc(true);
    try {
      // Prioridade padrão
      const priorityMap = {
        codigo_tributario: 1,
        descricao_codigo: 2,
        descricao_nbs: 3,
        palavra_chave: 4,
        fallback: 5,
      };

      const ruleData: ClassificationRule = {
        prioridade: priorityMap[tipoRegra],
        tipo_regra: tipoRegra,
        padrao_busca: tipoRegra === "fallback" ? "*" : padraoBusca.trim(),
        tipo_servico: tipoServico,
        categoria_sintetica: categoriaSintetica,
        descricao_regra: descricaoRegra.trim() || undefined,
      };

      if (editingRuleId !== null) {
        ruleData.id = editingRuleId;
      }

      await db.classificationRules.put(ruleData);
      await recalculateAllClassifications();
      
      toast.success(editingRuleId ? "Regra atualizada com sucesso!" : "Nova regra adicionada!");
      resetForm();
    } catch (err: any) {
      toast.error(`Erro ao salvar regra: ${err.message || err}`);
    } finally {
      setLoadingRecalc(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm("Excluir esta regra de classificação? Todas as notas serão recalculadas.")) return;
    setLoadingRecalc(true);
    try {
      await db.classificationRules.delete(id);
      await recalculateAllClassifications();
      toast.success("Regra removida e faturamento reclassificado!");
    } catch (err: any) {
      toast.error(`Erro ao excluir regra: ${err.message || err}`);
    } finally {
      setLoadingRecalc(false);
    }
  };

  const handleReclassifyAll = async () => {
    setLoadingReclassif(true);
    setReclassifProgress({ done: 0, total: docsAtivos.length });
    setReclassifStats(null);
    try {
      const stats = await reclassifyAllSintetico((p) => setReclassifProgress(p));
      setReclassifStats(stats);
      toast.success(`Classificações atualizadas com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro na reclassificação: ${err.message}`);
    } finally {
      setLoadingReclassif(false);
      setReclassifProgress(null);
    }
  };

  // BI Metrics
  const metrics = useMemo(() => {
    let faturamentoClassificado = 0;
    let retidosClassificado = 0;

    docsAtivos.forEach((d) => {
      if (d.tipo_servico && d.tipo_servico !== "Outros Serviços") {
        faturamentoClassificado += d.valor_bruto;
        retidosClassificado += d.valor_retido;
      }
    });

    const aliqEfetiva = faturamentoClassificado > 0 ? (retidosClassificado / faturamentoClassificado) * 100 : 0;

    return {
      faturamentoClassificado,
      retidosClassificado,
      aliqEfetiva,
      total: docsAtivos.length,
      classificadas: docsAtivos.length - semClassificacao.length,
      cobertura: docsAtivos.length > 0 ? ((docsAtivos.length - semClassificacao.length) / docsAtivos.length) * 100 : 0,
    };
  }, [docsAtivos, semClassificacao]);

  // Chart Mappings
  const chartData = useMemo(() => {
    const serviceMap: Record<string, { faturamento: number; retido: number; count: number }> = {};
    docsAtivos.forEach((d) => {
      const serv = d.tipo_servico || "Outros Serviços";
      if (!serviceMap[serv]) {
        serviceMap[serv] = { faturamento: 0, retido: 0, count: 0 };
      }
      serviceMap[serv].faturamento += d.valor_bruto;
      serviceMap[serv].retido += d.valor_retido;
      serviceMap[serv].count += 1;
    });

    const dataList = Object.entries(serviceMap).map(([name, v]) => ({
      name,
      value: v.faturamento,
      retido: v.retido,
      count: v.count,
    })).sort((a, b) => b.value - a.value);

    return dataList;
  }, [docsAtivos]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Configuração do Motor de Classificação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeie códigos tributários, descrições NBS e palavras-chave diretamente para Atividades Econômicas sem intervenção manual.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleReclassifyAll}
            disabled={loadingReclassif || loadingRecalc || docsAtivos.length === 0}
            className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            {loadingReclassif ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Reclassificando...</>
            ) : (
              <><Zap className="h-4 w-4" />Reclassificar Serviços</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress indicators */}
      {loadingReclassif && reclassifProgress && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Atualizando notas... {reclassifProgress.done} de {reclassifProgress.total}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${reclassifProgress.total > 0 ? (reclassifProgress.done / reclassifProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Reclassification Stats */}
      {reclassifStats && !loadingReclassif && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            Reclassificação executada: {reclassifStats.total} documentos processados
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Código Tributário', value: reclassifStats.codigoTributario, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
              { label: 'LC 116',            value: reclassifStats.lc116,            color: 'text-blue-600',    bg: 'bg-blue-500/10' },
              { label: 'NBS',               value: reclassifStats.nbs,              color: 'text-violet-600',  bg: 'bg-violet-500/10' },
              { label: 'Heurística',        value: reclassifStats.heuristica,       color: 'text-amber-600',   bg: 'bg-amber-500/10' },
              { label: 'Não Classificado',  value: reclassifStats.naoClassificado,  color: 'text-rose-600',    bg: 'bg-rose-500/10' },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg p-3 text-center ${s.bg} border border-border/30`}>
                <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Alert */}
      {semClassificacao.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Serviços Sem Classificação Automática</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Existem <strong>{semClassificacao.length}</strong> notas fiscais ativas classificadas como <strong>Outros Serviços</strong>.
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
            Classificar Serviços Pendentes
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
          Dashboard de Classificações
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
          Tabela Central de Regras ({rules?.length ?? 0})
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

      <div className="space-y-6">
        {/* Tab 1: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Faturamento Mapeado</span>
                <div className="text-xl font-bold text-foreground font-mono">{fmtBRL(metrics.faturamentoClassificado)}</div>
                <span className="text-[10px] text-muted-foreground block">Excluindo faturamento genérico</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Retenção de Serviços Mapeados</span>
                <div className="text-xl font-bold text-foreground font-mono">{fmtBRL(metrics.retidosClassificado)}</div>
                <span className="text-[10px] text-muted-foreground block">Impostos retidos sob atividades identificadas</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Alíquota Efetiva Média</span>
                <div className="text-xl font-bold text-primary font-mono">{metrics.aliqEfetiva.toFixed(2)}%</div>
                <span className="text-[10px] text-muted-foreground block">Proporção retido/faturado</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">Cobertura de Atividades</span>
                <div className="text-xl font-bold text-foreground font-mono">
                  {metrics.classificadas} / {metrics.total}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  {metrics.cobertura.toFixed(1)}% das notas classificadas por regras
                </span>
              </div>
            </div>

            {/* Charts */}
            {docsAtivos.length === 0 ? (
              <div className="rounded-xl border border-border border-dashed p-12 text-center text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Importe arquivos XML para carregar os relatórios de atividades econômicas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Faturamento por Tipo de Serviço */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Faturamento Bruto por Atividade</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 10, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                        <XAxis type="number" fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" fontSize={10} stroke="var(--color-muted-foreground)" width={120} />
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill={C.blue} radius={[0, 4, 4, 0]}>
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Participação das Atividades */}
                <div className="rounded-xl border border-border bg-card p-5 space-y-4 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participação do Tipo de Serviço</h3>
                  <div className="h-60 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETA[index % PALETA.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Volume Total</span>
                      <span className="text-sm font-bold text-foreground font-mono">{fmtBRL(metrics.faturamentoClassificado)}</span>
                    </div>
                  </div>
                  {/* Legend list */}
                  <div className="flex-1 overflow-y-auto max-h-[120px] text-xs space-y-1.5 mt-2 pr-1">
                    {chartData.map((d, index) => {
                      const pct = metrics.faturamentoClassificado > 0 ? (d.value / metrics.faturamentoClassificado) * 100 : 0;
                      return (
                        <div key={d.name} className="flex items-center justify-between text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PALETA[index % PALETA.length] }} />
                            <span className="truncate">{d.name}</span>
                          </div>
                          <span className="font-semibold text-foreground">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Regras */}
        {activeTab === "regras" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 h-fit">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                {editingRuleId ? <Edit className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
                {editingRuleId ? "Editar Regra de Classificação" : "Nova Regra de Classificação"}
              </h3>

              <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
                {/* Tipo de Regra */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Tipo de Regra (Prioridade)</label>
                  <select
                    value={tipoRegra}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setTipoRegra(val);
                      if (val === "fallback") setPadraoBusca("*");
                      else if (padraoBusca === "*") setPadraoBusca("");
                    }}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="codigo_tributario">Código Tributário Exato (Prioridade 1)</option>
                    <option value="descricao_codigo">Descrição do Código Tributário (Prioridade 2)</option>
                    <option value="descricao_nbs">Descrição do NBS (Prioridade 3)</option>
                    <option value="palavra_chave">Palavras-chave Heurística (Prioridade 4)</option>
                    <option value="fallback">Fallback de Outros Serviços (Prioridade 5)</option>
                  </select>
                </div>

                {/* Padrão de Busca */}
                {tipoRegra !== "fallback" && (
                  <div className="space-y-1 animate-in fade-in duration-200">
                    <label className="font-medium text-muted-foreground">Padrão de Busca (Chave)</label>
                    <Input
                      placeholder={
                        tipoRegra === "codigo_tributario" ? "Ex: 01.01 ou 042201" :
                        tipoRegra === "descricao_codigo" ? "Ex: desenvolvimento de sistemas" :
                        tipoRegra === "descricao_nbs" ? "Ex: plano privado de saúde" :
                        "Ex: consultoria, software, locacao"
                      }
                      value={padraoBusca}
                      onChange={(e) => setPadraoBusca(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Tipo de Serviço Dropdown */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Tipo de Serviço (Atividade)</label>
                  <select
                    value={tipoServico}
                    onChange={(e) => setTipoServico(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {TIPOS_SERVICO.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* Categoria Sintética (Auto-calculated) */}
                <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg border border-border/50">
                  <span className="font-bold text-[10px] text-muted-foreground block uppercase tracking-wider">Categoria Sintética Associada</span>
                  <div className="flex items-center gap-1.5 mt-1 font-semibold text-primary">
                    <Layers className="h-4.5 w-4.5 shrink-0" />
                    <span>{categoriaSintetica}</span>
                  </div>
                </div>

                {/* Descrição da Regra */}
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Observação / Descrição da Regra</label>
                  <Input
                    placeholder="Ex: Regra geral de TI"
                    value={descricaoRegra}
                    onChange={(e) => setDescricaoRegra(e.target.value)}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1" disabled={loadingRecalc}>
                    {editingRuleId ? "Atualizar" : "Salvar Regra"}
                  </Button>
                  {(editingRuleId || padraoBusca) && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Limpar
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* List */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="font-semibold text-sm">Regras de Classificação</h3>
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar regras..."
                    value={buscaRegra}
                    onChange={(e) => setBuscaRegra(e.target.value)}
                    className="pl-7 h-8 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">Prio</TableHead>
                      <TableHead>Critério / Tipo</TableHead>
                      <TableHead>Padrão de Busca</TableHead>
                      <TableHead>Mapeamento de Destino</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rulesFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                          Nenhuma regra corresponde à busca.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rulesFiltradas.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-mono text-[10px] w-6 h-6 rounded-full flex items-center justify-center p-0 mx-auto">
                              {rule.prioridade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{LABELS_TIPO_REGRA[rule.tipo_regra]}</div>
                            {rule.descricao_regra && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={rule.descricao_regra}>{rule.descricao_regra}</div>}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {rule.padrao_busca}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold text-foreground">{rule.tipo_servico}</div>
                            <div className="text-[10px] text-muted-foreground">Sintética: {rule.categoria_sintetica}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5 justify-end">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditRule(rule)}>
                                <Edit className="h-3.5 w-3.5 text-primary" />
                              </Button>
                              {rule.tipo_regra !== "fallback" && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteRule(rule.id!)}>
                                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Aprendizado Assistido */}
        {activeTab === "pendentes" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm">Serviços Classificados Como Fallback</h3>
                <p className="text-xs text-muted-foreground">
                  Estas notas fiscais corresponderam à regra de fallback ("Outros Serviços"). Crie uma regra específica para classificá-las em categorias executivas.
                </p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar notas fiscais..."
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
                    <TableHead>Discriminação / Descrição</TableHead>
                    <TableHead>NBS</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
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
                            <div className="font-semibold text-foreground">Cobertura Completa!</div>
                            <div>Todas as notas fiscais foram classificadas com atividades adequadas.</div>
                          </div>
                        ) : (
                          "Nenhuma nota localizada."
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    semClassificacaoFiltrada.map((doc) => (
                      <TableRow key={doc.id_nota}>
                        <TableCell className="text-[10px] font-mono">{fmtCompet(doc.data_competencia)}</TableCell>
                        <TableCell className="text-[10px] font-mono truncate max-w-[100px]" title={doc.id_nota}>
                          {doc.id_nota}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium truncate max-w-[120px]" title={doc.nome_tomador}>
                            <span className="text-muted-foreground">T:</span> {doc.nome_tomador || "—"}
                          </div>
                          <div className="text-muted-foreground text-[10px] truncate max-w-[120px]" title={doc.nome_prestador}>
                            <span className="text-muted-foreground">P:</span> {doc.nome_prestador || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <div>LC116: {doc.item_lista_servico || "—"}</div>
                          <div className="text-[10px] text-muted-foreground">Municipal: {doc.codigo_servico || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground" title={doc.descricao_servico}>
                          {doc.descricao_servico || "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate" title={doc.descricao_nbs}>
                          {doc.codigo_nbs ? `${doc.codigo_nbs} - ` : ""} {doc.descricao_nbs || "—"}
                        </TableCell>
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
