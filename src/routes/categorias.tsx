import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { db, type ServiceClassification, type CategoryRule, type AuditLog } from "@/lib/db";
import { useAuthStore } from "@/store/useAuthStore";
import { SyncManager } from "@/lib/data-access/SyncManager";
import {
  classificarServicoLocal,
  resolverServicoFiscal,
  MAPEAMENTO_PADRAO_LC116,
  MAPEAMENTO_PREFIXO_LC116,
  getServicoDescricao
} from "@/lib/category-utils";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  Settings,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  FileText,
  HelpCircle,
  Cpu,
  Layers,
  ArrowRight,
  User,
  Info,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  mes: z.string().optional().catch("__all__"),
  ano: z.string().optional().catch("__all__"),
  empresa: z.string().optional().catch("__all__"),
  cServ: z.string().optional().catch("__all__"),
  searchCliente: z.string().optional().catch(""),
});

export const Route = createFileRoute("/categorias")({
  validateSearch: searchSchema,
  component: CategoriasRouteComponent,
});

const DEFAULT_CATEGORIAS_EXECUTIVAS = [
  "Saúde",
  "Tecnologia",
  "Educação",
  "Consultoria",
  "Engenharia",
  "Jurídico",
  "Construção Civil",
  "Serviços Financeiros",
  "Marketing",
  "Logística",
  "Administração",
  "Outros Serviços"
];

const GRUPO_OPERACIONAL_SUGESTOES = [
  "Desenvolvimento de Software",
  "Consultoria Tributária",
  "Serviços Hospitalares",
  "Exames Laboratoriais",
  "Assessoria Jurídica",
  "Transporte Rodoviário",
  "Projetos Estruturais",
  "Serviços de TI",
  "Suporte Técnico",
  "Licenciamento de Software",
  "Hospedagem e Cloud",
  "Pesquisa e Desenvolvimento",
  "Locação de Bens",
  "Cessão de Direitos",
  "Atendimento Clínico",
  "Serviços de Enfermagem",
  "Treinamentos e Cursos",
  "Intermediação de Negócios",
  "Segurança e Vigilância",
  "Limpeza e Conservação",
  "Manutenção e Suporte",
  "Operações Financeiras",
  "Gestão de Recursos",
  "Seguros e Previdência",
  "Transporte de Passageiros",
  "Serviços Contábeis",
  "Serviços de Apoio",
  "Propaganda e Publicidade"
];

function formatarData(isoString: string): string {
  if (!isoString) return "-";
  try {
    const parts = isoString.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoString;
  } catch {
    return isoString;
  }
}

function formatarHora(isoString: string): string {
  if (!isoString) return "";
  try {
    const timePart = isoString.split("T")[1];
    if (timePart) {
      return timePart.slice(0, 5); // HH:MM
    }
    return "";
  } catch {
    return "";
  }
}

function CategoriasRouteComponent() {
  const { session } = useAuthStore();
  const [tabActive, setTabActive] = useState<"classifications" | "pending" | "rules" | "audit">("classifications");
  const [searchCat, setSearchCat] = useState("");
  
  // Selection states
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  // Edit / Reclassify Dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCodes, setEditingCodes] = useState<string[]>([]);
  const [formExecutiva, setFormExecutiva] = useState("Saúde");
  const [formGrupo, setFormGrupo] = useState("");
  const [formUser, setFormUser] = useState("Administrador");
  const [formJustification, setFormJustification] = useState("");

  // Rules Dialog state
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  const [ruleTipo, setRuleTipo] = useState<"codigo" | "descricao">("codigo");
  const [ruleChave, setRuleChave] = useState("");
  const [ruleExecutiva, setRuleExecutiva] = useState("Saúde");
  const [ruleGrupo, setRuleGrupo] = useState("");

  // Live Database Queries
  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], []);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], []);
  const classifications = useLiveQuery(() => db.serviceClassifications.toArray(), [], []);
  const rules = useLiveQuery(() => db.categoryRules.toArray(), [], []);
  const auditLogs = useLiveQuery(() => db.auditLogs.orderBy("dataHora").reverse().toArray(), [], []);

  // 1. Run background incremental classification whenever notes or rules change
  useEffect(() => {
    if (!todasNotas || !todasNotasTomadas || !classifications || !rules) return;

    const runIncrementalClassification = async () => {
      // Obter códigos únicos das notas
      const codesMap = new Map<string, { code: string; desc: string }>();
      const combined = [
        ...todasNotas.map(n => ({ code: n.codTribNacional, desc: n.servico })),
        ...todasNotasTomadas.map(n => ({ code: n.codTribNacional, desc: n.servico }))
      ];

      for (const { code, desc } of combined) {
        if (!code) continue;
        if (!codesMap.has(code)) {
          codesMap.set(code, { code, desc: desc || "" });
        } else if (!codesMap.get(code)!.desc && desc) {
          codesMap.get(code)!.desc = desc;
        }
      }

      const currentClassifications = new Map(classifications.map(c => [c.codigo, c]));
      const toPut: ServiceClassification[] = [];

      for (const [code, info] of codesMap.entries()) {
        const existing = currentClassifications.get(code);
        
        // Reclassifica se não existir, ou se for automático (para atualizar se as regras mudaram)
        if (!existing) {
          const res = classificarServicoLocal(code, info.desc, rules);
          toPut.push(res);
        } else if (existing.origem !== "Manual") {
          const res = classificarServicoLocal(code, info.desc, rules);
          if (
            res.categoriaExecutiva !== existing.categoriaExecutiva ||
            res.grupoOperacional !== existing.grupoOperacional ||
            res.origem !== existing.origem ||
            res.confianca !== existing.confianca ||
            res.conflito !== existing.conflito ||
            res.ausenteOficial !== existing.ausenteOficial
          ) {
            toPut.push(res);
          }
        }
      }

      if (toPut.length > 0) {
        await db.serviceClassifications.bulkPut(toPut);
      }
    };

    runIncrementalClassification().catch(err => console.error("Erro no processamento incremental:", err));
  }, [todasNotas, todasNotasTomadas, classifications, rules]);

  // 2. Compute rows for table with faturamento and counts
  const rows = useMemo(() => {
    if (!todasNotas || !todasNotasTomadas || !classifications) return [];

    const statsMap = new Map<string, { count: number; totalValor: number; lastUsed: string }>();

    const processNote = (n: any) => {
      const code = n.codTribNacional;
      if (!code) return;
      const val = n.valor || 0;
      const date = n.dCompet || n.dhEmi || "";
      const dateStr = date ? date.slice(0, 10) : "";

      if (!statsMap.has(code)) {
        statsMap.set(code, { count: 1, totalValor: val, lastUsed: dateStr });
      } else {
        const item = statsMap.get(code)!;
        item.count++;
        item.totalValor += val;
        if (dateStr && (!item.lastUsed || dateStr > item.lastUsed)) {
          item.lastUsed = dateStr;
        }
      }
    };

    todasNotas.forEach(processNote);
    todasNotasTomadas.forEach(processNote);

    return classifications.map(c => {
      const stats = statsMap.get(c.codigo) || { count: 0, totalValor: 0, lastUsed: "" };
      return {
        ...c,
        quantidadeNotas: stats.count,
        valorFaturado: stats.totalValor,
        ultimaUtilizacao: stats.lastUsed,
      };
    }).sort((a, b) => b.quantidadeNotas - a.quantidadeNotas);
  }, [todasNotas, todasNotasTomadas, classifications]);

  // Filter pending review rows
  const pendingRows = useMemo(() => {
    return rows.filter(r => 
      r.confianca < 90 || 
      r.origem === "Não Classificada" || 
      r.conflito || 
      r.ausenteOficial
    );
  }, [rows]);

  // Statistics calculations
  const totalServices = rows.length;
  const pendingCount = pendingRows.length;
  const totalValorFaturado = rows.reduce((acc, r) => acc + r.valorFaturado, 0);

  const automationRate = useMemo(() => {
    if (totalServices === 0) return 0;
    const autoCount = rows.filter(r => r.origem !== "Manual" && r.origem !== "Não Classificada").length;
    return Math.round((autoCount / totalServices) * 100);
  }, [rows, totalServices]);

  // Filtered rows for the active tab tables
  const filteredRows = useMemo(() => {
    const query = searchCat.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(r =>
      r.codigo.toLowerCase().includes(query) ||
      (r.categoriaExecutiva && r.categoriaExecutiva.toLowerCase().includes(query)) ||
      (r.grupoOperacional && r.grupoOperacional.toLowerCase().includes(query)) ||
      (r.descricaoLc116 && r.descricaoLc116.toLowerCase().includes(query)) ||
      (r.descricaoNbs && r.descricaoNbs.toLowerCase().includes(query)) ||
      (r.origem && r.origem.toLowerCase().includes(query))
    );
  }, [rows, searchCat]);

  const filteredPendingRows = useMemo(() => {
    const query = searchCat.toLowerCase().trim();
    if (!query) return pendingRows;
    return pendingRows.filter(r =>
      r.codigo.toLowerCase().includes(query) ||
      (r.categoriaExecutiva && r.categoriaExecutiva.toLowerCase().includes(query)) ||
      (r.grupoOperacional && r.grupoOperacional.toLowerCase().includes(query)) ||
      (r.descricaoLc116 && r.descricaoLc116.toLowerCase().includes(query)) ||
      (r.descricaoNbs && r.descricaoNbs.toLowerCase().includes(query))
    );
  }, [pendingRows, searchCat]);

  const filteredRules = useMemo(() => {
    if (!rules) return [];
    const query = searchCat.toLowerCase().trim();
    if (!query) return rules;
    return rules.filter(r =>
      r.chave.toLowerCase().includes(query) ||
      r.categoriaExecutiva.toLowerCase().includes(query) ||
      r.grupoOperacional.toLowerCase().includes(query)
    );
  }, [rules, searchCat]);

  const filteredAuditLogs = useMemo(() => {
    if (!auditLogs) return [];
    const query = searchCat.toLowerCase().trim();
    if (!query) return auditLogs;
    return auditLogs.filter(l =>
      l.codigo.toLowerCase().includes(query) ||
      l.classificacaoAnterior.toLowerCase().includes(query) ||
      l.classificacaoNova.toLowerCase().includes(query) ||
      l.usuario.toLowerCase().includes(query) ||
      (l.justificativa && l.justificativa.toLowerCase().includes(query))
    );
  }, [auditLogs, searchCat]);

  // Handlers for selection
  const handleSelectAll = (checked: boolean, targetRows: typeof rows) => {
    if (checked) {
      setSelectedCodes(new Set(targetRows.map(r => r.codigo)));
    } else {
      setSelectedCodes(new Set());
    }
  };

  const handleSelectRow = (code: string, checked: boolean) => {
    const next = new Set(selectedCodes);
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    setSelectedCodes(next);
  };

  // Reclassification submission
  const handleOpenEditDialog = (codes: string[]) => {
    setEditingCodes(codes);
    // Prefill form if editing a single item
    if (codes.length === 1) {
      const match = rows.find(r => r.codigo === codes[0]);
      if (match) {
        setFormExecutiva(match.categoriaExecutiva || "Saúde");
        setFormGrupo(match.grupoOperacional || "");
      }
    } else {
      setFormExecutiva("Saúde");
      setFormGrupo("");
    }
    setFormJustification("");
    setIsEditDialogOpen(true);
  };

  const handleSaveReclassification = async () => {
    if (!formExecutiva.trim() || !formGrupo.trim()) {
      toast.error("Por favor, preencha a Categoria Executiva e o Grupo Operacional.");
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      const updatedClassifications: ServiceClassification[] = [];

      for (const code of editingCodes) {
        const existing = rows.find(r => r.codigo === code);
        const oldClass = existing
          ? `${existing.categoriaExecutiva || "Não Classificada"} > ${existing.grupoOperacional || "Sem Grupo"}`
          : "Não Classificada";
        const newClass = `${formExecutiva} > ${formGrupo}`;

        // 1. Salva ou atualiza a regra de aprendizado (reutilização automática)
        // Usamos o código como chave da regra
        const existingRule = rules?.find(r => r.tipo === "codigo" && r.chave === code);
        if (existingRule) {
          await db.categoryRules.update(existingRule.id!, {
            categoriaExecutiva: formExecutiva,
            grupoOperacional: formGrupo
          });
        } else {
          await db.categoryRules.put({
            tipo: "codigo",
            chave: code,
            categoriaExecutiva: formExecutiva,
            grupoOperacional: formGrupo
          });
        }

        // 2. Atualiza o cache do ServiceClassification
        const { itemLC116, descricaoLC116, nbs, descricaoNbs } = resolverServicoFiscal(code);
        const classificationUpdate: ServiceClassification = {
          codigo: code,
          categoriaExecutiva: formExecutiva,
          grupoOperacional: formGrupo,
          codigoLc116: itemLC116 || (code.length <= 4 ? code : ""),
          descricaoLc116,
          codigoNbs: nbs || (code.length >= 9 ? code : ""),
          descricaoNbs,
          origem: "Manual",
          confianca: 100,
          metodo: "Regra Manual",
          dataClassificacao: nowStr,
          conflito: false,
          ausenteOficial: !itemLC116 && !nbs
        };
        updatedClassifications.push(classificationUpdate);

        // 3. Grava o log de auditoria
        await db.auditLogs.put({
          codigo: code,
          classificacaoAnterior: oldClass,
          classificacaoNova: newClass,
          usuario: formUser || "Administrador",
          dataHora: nowStr,
          justificativa: formJustification || undefined
        });
      }

      await db.serviceClassifications.bulkPut(updatedClassifications);

      if (session?.user?.id) {
        SyncManager.syncAll(session.user.id);
      }

      toast.success(
        editingCodes.length === 1
          ? "Classificação atualizada e regra salva com sucesso."
          : `${editingCodes.length} classificações atualizadas em lote com sucesso.`
      );

      // Reset states
      setIsEditDialogOpen(false);
      setSelectedCodes(new Set());
      setEditingCodes([]);
    } catch (err) {
      console.error("Erro ao salvar reclassificação:", err);
      toast.error("Ocorreu um erro ao salvar as alterações.");
    }
  };

  // Rule CRUD handlers
  const handleOpenRuleDialog = (rule: CategoryRule | null) => {
    if (rule) {
      setEditingRule(rule);
      setRuleTipo(rule.tipo);
      setRuleChave(rule.chave);
      setRuleExecutiva(rule.categoriaExecutiva);
      setRuleGrupo(rule.grupoOperacional);
    } else {
      setEditingRule(null);
      setRuleTipo("codigo");
      setRuleChave("");
      setRuleExecutiva("Saúde");
      setRuleGrupo("");
    }
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleChave.trim() || !ruleExecutiva.trim() || !ruleGrupo.trim()) {
      toast.error("Por favor, preencha todos os campos da regra.");
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      let ruleId: number | undefined;

      if (editingRule) {
        ruleId = editingRule.id;
        await db.categoryRules.update(editingRule.id!, {
          tipo: ruleTipo,
          chave: ruleChave,
          categoriaExecutiva: ruleExecutiva,
          grupoOperacional: ruleGrupo
        });
      } else {
        ruleId = await db.categoryRules.put({
          tipo: ruleTipo,
          chave: ruleChave,
          categoriaExecutiva: ruleExecutiva,
          grupoOperacional: ruleGrupo
        });
      }

      // Reclassifica as classificações afetadas
      if (ruleTipo === "codigo") {
        const code = ruleChave.trim();
        const combined = [
          ...todasNotas.map(n => ({ code: n.codTribNacional, desc: n.servico })),
          ...todasNotasTomadas.map(n => ({ code: n.codTribNacional, desc: n.servico }))
        ];
        const matchedNotes = combined.filter(n => n.code === code);
        const desc = matchedNotes[0]?.desc || "";

        const updatedRules = await db.categoryRules.toArray();
        const res = classificarServicoLocal(code, desc, updatedRules);
        await db.serviceClassifications.put(res);

        // Adiciona registro de auditoria
        await db.auditLogs.put({
          codigo: code,
          classificacaoAnterior: "Atualização de Regra",
          classificacaoNova: `${ruleExecutiva} > ${ruleGrupo}`,
          usuario: "Sistema (Regra)",
          dataHora: nowStr,
          justificativa: "Regra customizada criada/editada diretamente"
        });
      }

      toast.success("Regra de aprendizado salva.");
      if (session?.user?.id) {
        SyncManager.syncAll(session.user.id);
      }
      setIsRuleDialogOpen(false);
    } catch (err) {
      console.error("Erro ao salvar regra:", err);
      toast.error("Erro ao salvar a regra.");
    }
  };

  const handleDeleteRule = async (ruleId: number, codeKey: string) => {
    if (!confirm("Tem certeza que deseja excluir esta regra? A classificação do serviço retornará para automática.")) return;
    
    try {
      await db.categoryRules.delete(ruleId);
      
      const combined = [
        ...todasNotas.map(n => ({ code: n.codTribNacional, desc: n.servico })),
        ...todasNotasTomadas.map(n => ({ code: n.codTribNacional, desc: n.servico }))
      ];
      const matched = combined.find(n => n.code === codeKey);
      const desc = matched?.desc || "";
      
      const updatedRules = rules.filter(r => r.id !== ruleId);
      const reclassified = classificarServicoLocal(codeKey, desc, updatedRules);
      
      await db.serviceClassifications.put(reclassified);
      toast.success("Regra excluída e serviço reclassificado automaticamente.");
      if (session?.user?.id) {
        SyncManager.syncAll(session.user.id);
      }
    } catch (err) {
      console.error("Erro ao deletar regra:", err);
      toast.error("Erro ao deletar regra.");
    }
  };

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1450px] w-full mx-auto space-y-6">
      
      {/* Top Header Controls Section */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Cpu className="h-6 w-6 text-indigo-500" />
              Gestão de Categorias e Classificação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Motor inteligente de categorização de NFS-e baseado em prioridades (LC 116 + NBS, Regras Manuais e Similaridade Textual).
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Serviços Únicos</p>
            <p className="text-2xl font-extrabold text-foreground mt-0.5">{totalServices}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Automação Geral</p>
            <p className="text-2xl font-extrabold text-foreground mt-0.5">{automationRate}%</p>
          </div>
        </div>

        <div className={`bg-card border rounded-2xl p-5 shadow-xs flex items-center gap-4 transition-colors ${
          pendingCount > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border"
        }`}>
          <div className={`p-3 rounded-xl ${
            pendingCount > 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Revisões Pendentes</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {pendingCount}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Faturamento Total</p>
            <p className="text-2xl font-extrabold text-foreground mt-0.5">
              R$ {totalValorFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          onClick={() => { setTabActive("classifications"); setSearchCat(""); setSelectedCodes(new Set()); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            tabActive === "classifications"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Classificações
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-bold">{totalServices}</span>
        </button>

        <button
          onClick={() => { setTabActive("pending"); setSearchCat(""); setSelectedCodes(new Set()); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            tabActive === "pending"
              ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Revisão Inteligente
          {pendingCount > 0 && (
            <span className="text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => { setTabActive("rules"); setSearchCat(""); setSelectedCodes(new Set()); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            tabActive === "rules"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Regras de Aprendizado
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-bold">{(rules || []).length}</span>
        </button>

        <button
          onClick={() => { setTabActive("audit"); setSearchCat(""); setSelectedCodes(new Set()); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            tabActive === "audit"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 rounded-t-lg"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Histórico de Auditoria
        </button>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        
        {/* Search / Filter Utility Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchCat}
              onChange={(e) => setSearchCat(e.target.value)}
              className="pl-9 pr-3 h-9 text-sm rounded-lg border border-border bg-muted/30 outline-hidden focus:ring-2 focus:ring-indigo-500/30 w-full text-foreground"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {tabActive === "rules" && (
              <button
                onClick={() => handleOpenRuleDialog(null)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9 px-3 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Criar Regra
              </button>
            )}
          </div>
        </div>

        {/* Tab Content: Classifications */}
        {tabActive === "classifications" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            {filteredRows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum serviço encontrado. Importe arquivos XML primeiro.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCodes.size === filteredRows.length && filteredRows.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked, filteredRows)}
                          className="rounded-md border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5 w-24">Código</th>
                      <th className="px-4 py-3.5">Categoria Executiva</th>
                      <th className="px-4 py-3.5">Grupo Operacional</th>
                      <th className="px-4 py-3.5">Serviço Fiscal (LC 116 / NBS)</th>
                      <th className="px-4 py-3.5 text-center w-20">Notas</th>
                      <th className="px-4 py-3.5 text-right w-32">Valor Faturado</th>
                      <th className="px-4 py-3.5 text-center w-24">Origem</th>
                      <th className="px-4 py-3.5 text-center w-20">Confiança</th>
                      <th className="px-4 py-3.5 text-right w-24">Última Util.</th>
                      <th className="px-4 py-3.5 text-center w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map((linha) => {
                      const statusColor = 
                        linha.origem === "Manual" ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" :
                        linha.origem === "Automática LC 116" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" :
                        linha.origem === "Automática NBS" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                        linha.origem === "Similaridade" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                        "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";

                      const scoreColor =
                        linha.confianca >= 98 ? "text-green-600 dark:text-green-400" :
                        linha.confianca >= 85 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400";

                      return (
                        <tr key={linha.codigo} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCodes.has(linha.codigo)}
                              onChange={(e) => handleSelectRow(linha.codigo, e.target.checked)}
                              className="rounded-md border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded-md font-semibold text-foreground/95">
                              {linha.codigo}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {linha.categoriaExecutiva}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {linha.grupoOperacional}
                          </td>
                          <td className="px-4 py-3 max-w-[280px]">
                            {linha.codigoLc116 && (
                              <div className="flex flex-col gap-0.5 mb-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">LC 116: {linha.codigoLc116}</span>
                                <span className="truncate text-foreground/80" title={linha.descricaoLc116}>{linha.descricaoLc116}</span>
                              </div>
                            )}
                            {linha.codigoNbs && (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">NBS: {linha.codigoNbs}</span>
                                <span className="truncate text-foreground/80 text-[11px]" title={linha.descricaoNbs}>{linha.descricaoNbs}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-medium">
                            {linha.quantidadeNotas}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            R$ {linha.valorFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColor}`}>
                              {linha.origem}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold">
                            <span className={scoreColor}>{linha.confianca}%</span>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                            {formatarData(linha.ultimaUtilizacao)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenEditDialog([linha.codigo])}
                              className="text-indigo-600 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                              title="Reclassificar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Pending smart review */}
        {tabActive === "pending" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            {filteredPendingRows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Nenhuma pendência de revisão encontrada!</p>
                  <p className="text-xs mt-1 text-muted-foreground">Todas as classificações automáticas possuem confiança igual ou superior a 90% e mapeamentos consistentes.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-400">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>
                    Estes serviços exigem atenção devido a uma ou mais condições: 
                    <strong> Baixa Confiança (&lt;90%)</strong>, 
                    <strong> Novo serviço</strong>, 
                    <strong> Conflito de códigos</strong> ou 
                    <strong> Ausência de mapeamento oficial</strong>.
                  </span>
                </div>
                
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCodes.size === filteredPendingRows.length && filteredPendingRows.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked, filteredPendingRows)}
                          className="rounded-md border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5 w-24">Código</th>
                      <th className="px-4 py-3.5">Categoria Executiva</th>
                      <th className="px-4 py-3.5">Grupo Operacional</th>
                      <th className="px-4 py-3.5">Alertas de Pendência</th>
                      <th className="px-4 py-3.5 text-center w-20">Notas</th>
                      <th className="px-4 py-3.5 text-right w-32">Valor Faturado</th>
                      <th className="px-4 py-3.5 text-center w-20">Confiança</th>
                      <th className="px-4 py-3.5 text-right w-24">Última Util.</th>
                      <th className="px-4 py-3.5 text-center w-16">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPendingRows.map((linha) => {
                      const alertas = [];
                      if (linha.confianca < 90) alertas.push("📉 Confiança Baixa");
                      if (linha.origem === "Não Classificada") alertas.push("❓ Nunca Classificado");
                      if (linha.conflito) alertas.push("⚡ Conflito LC 116 / NBS");
                      if (linha.ausenteOficial) alertas.push("🔍 Fora do Mapeamento Oficial");

                      return (
                        <tr key={linha.codigo} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCodes.has(linha.codigo)}
                              onChange={(e) => handleSelectRow(linha.codigo, e.target.checked)}
                              className="rounded-md border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded-md font-semibold text-foreground/95">
                              {linha.codigo}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {linha.categoriaExecutiva}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {linha.grupoOperacional}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {alertas.map((al, idx) => (
                                <span key={idx} className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                  {al}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-medium">
                            {linha.quantidadeNotas}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            R$ {linha.valorFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                            {linha.confianca}%
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground font-mono">
                            {formatarData(linha.ultimaUtilizacao)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenEditDialog([linha.codigo])}
                              className="text-amber-600 hover:text-amber-500 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                              title="Revisar"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Rules list */}
        {tabActive === "rules" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            {filteredRules.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhuma regra personalizada cadastrada. Crie uma regra clicando no botão no topo direito.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3.5">Tipo</th>
                      <th className="px-4 py-3.5">Chave da Regra</th>
                      <th className="px-4 py-3.5">Categoria Executiva (Nível 1)</th>
                      <th className="px-4 py-3.5">Grupo Operacional (Nível 2)</th>
                      <th className="px-4 py-3.5 text-center w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRules.map((regra) => (
                      <tr key={regra.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            regra.tipo === "codigo" 
                              ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" 
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          }`}>
                            {regra.tipo === "codigo" ? "Código" : "Descrição"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          {regra.chave}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {regra.categoriaExecutiva}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {regra.grupoOperacional}
                        </td>
                        <td className="px-4 py-3 text-center space-x-1">
                          <button
                            onClick={() => handleOpenRuleDialog(regra)}
                            className="text-indigo-600 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            title="Editar Regra"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(regra.id!, regra.chave)}
                            className="text-red-600 hover:text-red-500 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            title="Excluir Regra"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Audit History logs */}
        {tabActive === "audit" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <History className="h-8 w-8 text-muted-foreground/60" />
                <span>Nenhum log de auditoria encontrado.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3.5 w-24">Data / Hora</th>
                      <th className="px-4 py-3.5 w-24">Serviço</th>
                      <th className="px-4 py-3.5">De (Anterior)</th>
                      <th className="px-4 py-3.5 w-10 text-center"></th>
                      <th className="px-4 py-3.5">Para (Nova)</th>
                      <th className="px-4 py-3.5 w-32">Responsável</th>
                      <th className="px-4 py-3.5">Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {formatarData(log.dataHora)} <span className="text-[10px] text-muted-foreground/75 font-semibold ml-1">{formatarHora(log.dataHora)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded-md font-semibold text-foreground/95">
                            {log.codigo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-600 dark:text-red-400/80 font-medium">
                          {log.classificacaoAnterior}
                        </td>
                        <td className="px-2 py-3 text-center text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                        </td>
                        <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold">
                          {log.classificacaoNova}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap flex items-center gap-1.5 mt-1">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {log.usuario}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground italic max-w-[240px] truncate" title={log.justificativa}>
                          {log.justificativa || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedCodes.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border shadow-xl px-6 py-4 rounded-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-12 duration-200">
          <span className="text-xs text-foreground font-semibold flex items-center gap-2">
            <span className="h-5 w-5 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-[10px]">
              {selectedCodes.size}
            </span>
            serviço(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEditDialog(Array.from(selectedCodes))}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Classificar em Lote
            </button>
            <button
              onClick={() => setSelectedCodes(new Set())}
              className="bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* Dialog: Reclassify / Edit classification */}
      {isEditDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingCodes.length === 1 ? "Reclassificar Serviço" : "Classificar Serviços em Lote"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina as categorias executiva e operacional. Uma regra de reutilização automática será salva.
                </p>
              </div>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {editingCodes.length === 1 ? (
                <div className="p-3 bg-muted/40 border border-border rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Código do Serviço</p>
                  <p className="font-mono text-xs font-bold text-foreground mt-1">{editingCodes[0]}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getServicoDescricao(editingCodes[0])}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-muted/40 border border-border rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Serviços Selecionados</p>
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                    {editingCodes.map(c => (
                      <span key={c} className="font-mono bg-card border border-border px-1.5 py-0.5 rounded-md text-[10px] font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Categoria Executiva (Nível 1) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formExecutiva}
                      onChange={(e) => setFormExecutiva(e.target.value)}
                      className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground cursor-pointer appearance-none"
                    >
                      {DEFAULT_CATEGORIAS_EXECUTIVAS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Grupo Operacional (Nível 2) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="grupos-sugestoes"
                    value={formGrupo}
                    onChange={(e) => setFormGrupo(e.target.value)}
                    placeholder="Ex: Desenvolvimento de Software"
                    className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground"
                  />
                  <datalist id="grupos-sugestoes">
                    {GRUPO_OPERACIONAL_SUGESTOES.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                      Usuário Responsável <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formUser}
                      onChange={(e) => setFormUser(e.target.value)}
                      placeholder="Administrador"
                      className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Justificativa (Opcional)
                  </label>
                  <textarea
                    value={formJustification}
                    onChange={(e) => setFormJustification(e.target.value)}
                    placeholder="Descreva o motivo desta reclassificação para histórico de auditoria..."
                    rows={3}
                    className="w-full text-xs rounded-lg border border-border bg-card p-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 bg-muted/20 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="bg-card hover:bg-muted text-muted-foreground border border-border text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveReclassification}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Create / Edit Rule */}
      {isRuleDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingRule ? "Editar Regra de Aprendizado" : "Nova Regra de Aprendizado"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regras customizadas forçam a classificação automática com base em chaves específicas.
                </p>
              </div>
              <button
                onClick={() => setIsRuleDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Tipo de Chave <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="ruleTipo"
                        checked={ruleTipo === "codigo"}
                        onChange={() => setRuleTipo("codigo")}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      Código do Serviço (LC 116 / NBS)
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="ruleTipo"
                        checked={ruleTipo === "descricao"}
                        onChange={() => setRuleTipo("descricao")}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      Palavra-chave na Descrição
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Chave de Correspondência <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ruleChave}
                    onChange={(e) => setRuleChave(e.target.value)}
                    placeholder={ruleTipo === "codigo" ? "Ex: 01.01 ou 0101" : "Ex: assessoria contabil"}
                    className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Categoria Executiva (Nível 1) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={ruleExecutiva}
                      onChange={(e) => setRuleExecutiva(e.target.value)}
                      className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground cursor-pointer appearance-none"
                    >
                      {DEFAULT_CATEGORIAS_EXECUTIVAS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                    Grupo Operacional (Nível 2) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="grupos-sugestoes-regr"
                    value={ruleGrupo}
                    onChange={(e) => setRuleGrupo(e.target.value)}
                    placeholder="Ex: Desenvolvimento de Software"
                    className="w-full text-xs rounded-lg border border-border bg-card h-9 px-3 outline-hidden focus:ring-2 focus:ring-indigo-500/30 text-foreground"
                  />
                  <datalist id="grupos-sugestoes-regr">
                    {GRUPO_OPERACIONAL_SUGESTOES.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 bg-muted/20 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsRuleDialogOpen(false)}
                className="bg-card hover:bg-muted text-muted-foreground border border-border text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRule}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] text-muted-foreground pt-8 border-t border-border/80">
        🔒 Processamento inteligente 100% local — Suas decisões e histórico ficam armazenados de forma segura no seu navegador.
      </footer>
    </main>
  );
}
