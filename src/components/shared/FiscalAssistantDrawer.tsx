import { useState, useEffect, useRef, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  ChevronRight, 
  Send, 
  Sparkles, 
  Key, 
  Bot, 
  User, 
  Loader2, 
  AlertCircle, 
  MessageSquare,
  HelpCircle
} from "lucide-react";
import { db, type NotaFiscal, type NotaFiscalTomada, type ServiceClassification } from "@/lib/db";
import { useGlobalFilters } from "@/store/useGlobalFilters";
import { perguntarAoAssistente } from "@/lib/ai/categorizador";
import { toast } from "sonner";

interface FiscalAssistantDrawerProps {
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function FiscalAssistantDrawer({ assistantOpen, setAssistantOpen }: FiscalAssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o Assistente Fiscal Inteligente. Posso responder perguntas sobre o faturamento, impostos, retenções e categorias do período atualmente filtrado no seu painel. Como posso ajudar?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load API Key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("anthropic_api_key") || "";
      setApiKeyInput(savedKey);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSaveApiKey = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("anthropic_api_key", apiKeyInput.trim());
      toast.success("Chave de API Anthropic configurada localmente.");
      setShowKeyConfig(false);
    }
  };

  // ── Context Aggregation ──────────────────────────────────────────────────
  const { empresaFiltro, mesFiltro, anoFiltro, cServFiltro } = useGlobalFilters();

  const todasNotas = useLiveQuery(() => db.notas.toArray(), [], [] as NotaFiscal[]);
  const todasNotasTomadas = useLiveQuery(() => db.notasTomadas.toArray(), [], [] as NotaFiscalTomada[]);
  const classifications = useLiveQuery(() => db.serviceClassifications.toArray(), [], [] as ServiceClassification[]);

  // Filter notes based on active global filters
  const filteredEmitidas = useMemo(() => {
    if (!todasNotas) return [];
    return todasNotas.filter(n => {
      if (n.status !== "válida") return false;
      const d = n.dhEmi || n.dCompet || "";
      if (mesFiltro !== "__all__" && d.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && d.slice(0, 4) !== anoFiltro) return false;
      if (empresaFiltro !== "__all__" && n.cnpjPrestador !== empresaFiltro) return false;
      if (cServFiltro !== "__all__" && String(n.codTribNacional).replace(/^0+/, "") !== String(cServFiltro).replace(/^0+/, "")) return false;
      return true;
    });
  }, [todasNotas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro]);

  const filteredTomadas = useMemo(() => {
    if (!todasNotasTomadas) return [];
    return todasNotasTomadas.filter(n => {
      if (n.status !== "válida") return false;
      const d = n.dhEmi || n.dCompet || "";
      if (mesFiltro !== "__all__" && d.slice(5, 7) !== mesFiltro) return false;
      if (anoFiltro !== "__all__" && d.slice(0, 4) !== anoFiltro) return false;
      if (empresaFiltro !== "__all__" && n.cnpjTomador !== empresaFiltro) return false;
      if (cServFiltro !== "__all__" && String(n.codTribNacional).replace(/^0+/, "") !== String(cServFiltro).replace(/^0+/, "")) return false;
      return true;
    });
  }, [todasNotasTomadas, empresaFiltro, mesFiltro, anoFiltro, cServFiltro]);

  // Aggregate stats into compact text block
  const contextSummary = useMemo(() => {
    const classMap = new Map(classifications?.map(c => [c.codigo, c.categoriaExecutiva]) || []);
    
    // Group emitidas by company (CNPJ) and Category
    const emitidasGroups = new Map<string, { companyName: string; total: number; count: number; iss: number; issRet: number; irrf: number; csll: number; pis: number; cofins: number; inss: number; categories: Map<string, number>; topClients: Map<string, { name: string; issRet: number }> }>();
    
    filteredEmitidas.forEach(n => {
      const cnpj = n.cnpjPrestador;
      const cat = classMap.get(n.codTribNacional) || "Outros Serviços";
      
      if (!emitidasGroups.has(cnpj)) {
        emitidasGroups.set(cnpj, {
          companyName: n.nomePrestador || cnpj,
          total: 0,
          count: 0,
          iss: 0,
          issRet: 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          inss: 0,
          categories: new Map(),
          topClients: new Map()
        });
      }
      
      const g = emitidasGroups.get(cnpj)!;
      g.total += n.valor;
      g.count += 1;
      g.iss += n.vlrIss ?? 0;
      g.issRet += n.vlrIssRet ?? 0;
      g.irrf += n.vlrIrrf ?? 0;
      g.csll += n.vlrCsll ?? 0;
      g.pis += n.vlrPis ?? 0;
      g.cofins += n.vlrCofins ?? 0;
      g.inss += n.vlrInss ?? 0;
      g.categories.set(cat, (g.categories.get(cat) || 0) + n.valor);

      // Aggregate client contribution
      const clientKey = n.cnpjCpfCliente;
      if (!g.topClients.has(clientKey)) {
        g.topClients.set(clientKey, { name: n.cliente || clientKey, issRet: 0 });
      }
      g.topClients.get(clientKey)!.issRet += n.vlrIssRet ?? 0;
    });

    // Group tomadas by tomador and prestador
    const tomadasGroups = new Map<string, { companyName: string; total: number; count: number; issRet: number; irrf: number; csll: number; pis: number; cofins: number; inss: number; suppliers: Map<string, number> }>();
    
    filteredTomadas.forEach(n => {
      const cnpjTomador = n.cnpjTomador;
      const prestador = n.nomePrestador || n.cnpjPrestador;
      
      if (!tomadasGroups.has(cnpjTomador)) {
        tomadasGroups.set(cnpjTomador, {
          companyName: n.nomeTomador || cnpjTomador,
          total: 0,
          count: 0,
          issRet: n.vlrIssRet ?? 0,
          irrf: 0,
          csll: 0,
          pis: 0,
          cofins: 0,
          inss: 0,
          suppliers: new Map()
        });
      }
      
      const g = tomadasGroups.get(cnpjTomador)!;
      g.total += n.valor;
      g.count += 1;
      g.issRet += n.vlrIssRet ?? 0;
      g.irrf += n.vlrIrrf ?? 0;
      g.csll += n.vlrCsll ?? 0;
      g.pis += n.vlrPis ?? 0;
      g.cofins += n.vlrCofins ?? 0;
      g.inss += n.vlrInss ?? 0;
      g.suppliers.set(prestador, (g.suppliers.get(prestador) || 0) + n.valor);
    });

    // Generate summary text
    let text = `PERÍODO ANALISADO: Mês: ${mesFiltro === "__all__" ? "Todos" : mesFiltro}, Ano: ${anoFiltro === "__all__" ? "Todos" : anoFiltro}, Empresa: ${empresaFiltro === "__all__" ? "Todas" : empresaFiltro}\n\n`;
    
    text += `RECEITAS (NOTAS EMITIDAS VÁLIDAS):\n`;
    if (emitidasGroups.size === 0) {
      text += "- Sem dados de faturamento para o filtro selecionado.\n";
    } else {
      for (const [cnpj, g] of emitidasGroups.entries()) {
        text += `- Prestador: ${g.companyName} (CNPJ: ${cnpj})\n`;
        text += `  * Volume de Notas: ${g.count}\n`;
        text += `  * Faturamento Bruto Total: R$ ${g.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        text += `  * Impostos: ISS total: R$ ${g.iss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (com R$ ${g.issRet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} retido na fonte por tomadores), IRRF: R$ ${g.irrf.toLocaleString("pt-BR")}, CSLL: R$ ${g.csll.toLocaleString("pt-BR")}, PIS: R$ ${g.pis.toLocaleString("pt-BR")}, COFINS: R$ ${g.cofins.toLocaleString("pt-BR")}, INSS: R$ ${g.inss.toLocaleString("pt-BR")}\n`;
        text += `  * Faturamento por Categoria Executiva:\n`;
        for (const [cat, val] of g.categories.entries()) {
          text += `    - ${cat}: R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        }
        text += `  * Retenção de ISS por Cliente (Top 3):\n`;
        const sortedClients = Array.from(g.topClients.values()).sort((a,b) => b.issRet - a.issRet).slice(0, 3);
        for (const c of sortedClients) {
          text += `    - ${c.name}: R$ ${c.issRet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        }
      }
    }

    text += `\nDESPESAS (SERVIÇOS CONTRATADOS TOMADOS VÁLIDOS):\n`;
    if (tomadasGroups.size === 0) {
      text += "- Sem dados de despesas tomadas para o filtro selecionado.\n";
    } else {
      for (const [cnpj, g] of tomadasGroups.entries()) {
        text += `- Empresa Tomadora do Grupo: ${g.companyName} (CNPJ: ${cnpj})\n`;
        text += `  * Serviços Tomados: ${g.count} notas\n`;
        text += `  * Despesa Contratada Bruta: R$ ${g.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        text += `  * Impostos retidos de fornecedores: ISS Retido: R$ ${g.issRet.toLocaleString("pt-BR")}, IRRF: R$ ${g.irrf.toLocaleString("pt-BR")}, CSLL: R$ ${g.csll.toLocaleString("pt-BR")}, PIS: R$ ${g.pis.toLocaleString("pt-BR")}, COFINS: R$ ${g.cofins.toLocaleString("pt-BR")}, INSS: R$ ${g.inss.toLocaleString("pt-BR")}\n`;
        text += `  * Principais Fornecedores (Top 3):\n`;
        const sortedSuppliers = Array.from(g.suppliers.entries()).sort((a,b) => b[1] - a[1]).slice(0, 3);
        for (const [sup, val] of sortedSuppliers) {
          text += `    - ${sup}: R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`;
        }
      }
    }

    return text;
  }, [filteredEmitidas, filteredTomadas, classifications, empresaFiltro, mesFiltro, anoFiltro, cServFiltro]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    if (!textToSend) setInputValue("");
    setSending(true);

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: query
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const savedKey = localStorage.getItem("anthropic_api_key") || undefined;
      const historyToSend = messages.slice(1).map(m => ({ role: m.role, content: m.content })); // skip welcome

      const reply = await perguntarAoAssistente({
        data: {
          message: query,
          history: historyToSend,
          contextSummary: contextSummary,
          userApiKey: savedKey
        }
      });

      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: reply
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro de conexão com o assistente.");
      
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: `❌ Ocorreu um erro ao consultar o assistente: ${err?.message || "Erro desconhecido"}. Certifique-se de configurar a Chave de API da Anthropic.`
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const suggestions = [
    "Qual cliente reteve mais ISS?",
    "Quais serviços têm maior retenção de IRRF?",
    "Qual o faturamento bruto por empresa?"
  ];

  return (
    <>
      {/* Overlay */}
      {assistantOpen && (
        <div
          onClick={() => setAssistantOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 bg-card border-l border-border w-96 flex flex-col justify-between transition-transform duration-300 ease-in-out transform shadow-2xl flex-shrink-0 ${
          assistantOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Assistente Fiscal IA</h3>
              <p className="text-[9px] text-muted-foreground">Claude-3.5-Haiku • Dados consolidados do período</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className={`h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors cursor-pointer ${
                showKeyConfig ? "bg-muted text-indigo-600" : "text-muted-foreground"
              }`}
              title="Configurar Chave de API"
            >
              <Key className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setAssistantOpen(false)}
              className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collapsible API Key Configuration Section */}
        {showKeyConfig && (
          <div className="px-5 py-4 border-b border-border bg-slate-50 dark:bg-slate-950/20 text-xs space-y-2.5 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                <Key className="h-3 w-3 text-indigo-500" />
                Configurar Chave de API Local
              </span>
              <a 
                href="https://console.anthropic.com/" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[9px] text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                Obter Chave <HelpCircle className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Opcional. Insira sua chave `sk-ant-...` para processamento client-side direto. Se deixado em branco, o sistema tentará ler a chave `ANTHROPIC_API_KEY` do arquivo `.env` do servidor.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Insira sk-ant-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 h-8 px-2.5 rounded-lg bg-card border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleSaveApiKey}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] cursor-pointer transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/5 flex flex-col">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-2.5 max-w-[85%] ${
                msg.role === "user" ? "self-end flex-row-reverse" : "self-start"
              }`}
            >
              {/* Avatar */}
              <div className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                msg.role === "user" 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200" 
                  : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25"
              }`}>
                {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              </div>

              {/* Message Content Bubble */}
              <div className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-xs ${
                msg.role === "user" 
                  ? "bg-indigo-600 text-white rounded-tr-none font-medium" 
                  : "bg-card border border-border/80 text-foreground rounded-tl-none font-normal"
              }`}>
                <div className="whitespace-pre-line">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {sending && (
            <div className="flex items-start gap-2.5 self-start max-w-[85%] animate-pulse">
              <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center bg-indigo-500/10 text-indigo-600 border border-indigo-500/25">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-card border border-border/80 text-muted-foreground text-[10px] font-medium rounded-tl-none flex items-center gap-1.5">
                <span>Processando dados agregados com Claude...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips Panel (Rendered only when chat has no custom messages) */}
        {messages.length === 1 && (
          <div className="px-5 py-3 border-t border-border bg-muted/10 space-y-1.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Sugestões de Perguntas</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 rounded-full cursor-pointer transition-all text-left truncate max-w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input Panel */}
        <div className="p-4 border-t border-border bg-card">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl p-1 focus-within:ring-1 focus-within:ring-ring transition-all"
          >
            <input
              type="text"
              disabled={sending}
              placeholder="Digite sua dúvida fiscal..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 h-8 pl-2.5 bg-transparent border-0 text-xs focus:outline-none focus:ring-0 disabled:opacity-50 text-foreground"
            />
            <button
              type="submit"
              disabled={sending || !inputValue.trim()}
              className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center cursor-pointer transition-all disabled:opacity-30 disabled:scale-100 hover:scale-[1.02]"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          <div className="text-[8px] text-muted-foreground mt-2 text-center leading-tight flex items-center justify-center gap-1.5">
            <span>🔒 Os dados enviados são resumos analíticos e agregados da competência.</span>
          </div>
        </div>
      </aside>
    </>
  );
}


