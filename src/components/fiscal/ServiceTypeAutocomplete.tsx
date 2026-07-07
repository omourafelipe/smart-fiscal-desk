import { useState, useEffect } from "react";
import { useServiceClassification } from "@/hooks/useServiceClassification";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Loader2, CheckCircle2, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, Save, Undo2, CornerDownRight 
} from "lucide-react";
import { toast } from "sonner";

interface ServiceTypeAutocompleteProps {
  initialValue?: string;
  onSelectClassification?: (classification: {
    categoria: string;
    grupo: string;
    centro_receita: string;
    subcategoria: string;
  }) => void;
}

export function ServiceTypeAutocomplete({
  initialValue = "",
  onSelectClassification,
}: ServiceTypeAutocompleteProps) {
  const {
    description,
    setDescription,
    loading,
    error,
    result,
    feedbackStatus,
    sendFeedback,
    retry,
    resetFeedbackStatus,
  } = useServiceClassification(initialValue);

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [manualCat, setManualCat] = useState("");
  const [manualGrp, setManualGrp] = useState("");
  const [manualCr, setManualCr] = useState("");
  const [manualSub, setManualSub] = useState("");

  // Se o resultado mudar, atualiza os campos manuais para caso de ajuste
  useEffect(() => {
    if (result) {
      setManualCat(result.categoria);
      setManualGrp(result.grupo);
      setManualCr(result.centro_receita);
      setManualSub(result.subcategoria);
      
      // Notifica o componente pai sobre a classificação automática
      if (onSelectClassification) {
        onSelectClassification({
          categoria: result.categoria,
          grupo: result.grupo,
          centro_receita: result.centro_receita,
          subcategoria: result.subcategoria,
        });
      }
    }
  }, [result, onSelectClassification]);

  const handleApprove = async () => {
    if (!result) return;
    await sendFeedback({
      descricao_servico: description,
      categoria_sugerida: result.categoria,
      categoria_correta: result.categoria,
      grupo_correto: result.grupo,
      centro_receita_correto: result.centro_receita,
      subcategoria_correta: result.subcategoria,
      aprovado: true,
    });
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    
    if (!manualCat || !manualGrp || !manualCr || !manualSub) {
      toast.error("Preencha todos os campos gerenciais para salvar o ajuste.");
      return;
    }

    await sendFeedback({
      descricao_servico: description,
      categoria_sugerida: result.categoria,
      categoria_correta: manualCat,
      grupo_correto: manualGrp,
      centro_receita_correto: manualCr,
      subcategoria_correta: manualSub,
      aprovado: false,
    });

    if (onSelectClassification) {
      onSelectClassification({
        categoria: manualCat,
        grupo: manualGrp,
        centro_receita: manualCr,
        subcategoria: manualSub,
      });
    }

    setIsAdjusting(false);
  };

  // Cores do nível de confiança
  const getConfidenceStyle = (level: string) => {
    switch (level) {
      case "Muito Alta":
      case "Alta":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400";
      case "Média":
        return "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400";
      case "Baixa":
      default:
        return "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Campo de Input com Design de IA */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-500" />
          )}
        </div>
        <Input
          type="text"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setIsAdjusting(false);
            resetFeedbackStatus();
          }}
          placeholder="Descreva o serviço para classificação automática por IA..."
          className="pl-9 pr-10 py-5 text-sm bg-card border-border hover:border-border/80 focus:ring-purple-500 rounded-xl transition-all"
        />
        {description && (
          <button 
            onClick={() => {
              setDescription("");
              setIsAdjusting(false);
              resetFeedbackStatus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Cenário de Erro de Conexão (10% simulado) */}
      {error && (
        <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h5 className="text-xs font-semibold text-rose-700 dark:text-rose-300">Motor de classificação inacessível</h5>
              <p className="text-[11px] text-muted-foreground">{error}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={retry} className="h-7 text-[10px] border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/5">
                  Tentar novamente
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setIsAdjusting(true);
                    setManualCat("");
                    setManualGrp("");
                    setManualCr("");
                    setManualSub("");
                  }} 
                  className="h-7 text-[10px]"
                >
                  Preenchimento Manual
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cenário de Sucesso na Classificação */}
      {result && !error && (
        <div className="p-5 border border-border/80 bg-card rounded-xl shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block">Classificação Sugerida por IA</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">
                {result.categoria} &rsaquo; {result.subcategoria}
              </h4>
            </div>
            
            <Badge variant="outline" className={`text-[10px] font-mono border ${getConfidenceStyle(result.nivel_confianca)}`}>
              Confiança {result.nivel_confianca} ({Math.round(result.score_confianca * 100)}%)
            </Badge>
          </div>

          {/* Grid de Classificação Gerencial */}
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Grupo</span>
              <div className="font-medium text-foreground">{result.grupo}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Centro de Receita</span>
              <div className="font-medium text-foreground">{result.centro_receita}</div>
            </div>
          </div>

          {/* Ações de Feedback */}
          {feedbackStatus === "success" ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium py-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>Obrigado! Feedback enviado com sucesso.</span>
            </div>
          ) : feedbackStatus === "error" ? (
            <div className="flex items-center gap-2 text-xs text-rose-500 font-medium py-1">
              <XCircle className="h-4 w-4" />
              <span>Erro de conexão ao enviar feedback.</span>
              <Button size="sm" variant="ghost" onClick={handleApprove} className="h-6 text-[10px] p-0 underline ml-2 text-rose-600">
                Tentar reavaliar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleApprove} 
                  disabled={feedbackStatus === "loading"}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                >
                  {feedbackStatus === "loading" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Aprovar Sugestão
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsAdjusting(!isAdjusting)}
                  className="h-8 text-xs gap-1.5"
                >
                  {isAdjusting ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Ajustar Classificação
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulário de Ajuste Manual expandido */}
      {isAdjusting && (
        <form onSubmit={handleSaveAdjustment} className="p-4 bg-muted/40 border border-border rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <CornerDownRight className="h-4 w-4 text-purple-500" />
            <h5 className="text-xs font-semibold text-foreground">Modificar Parâmetros de Classificação</h5>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Categoria</label>
              <Input
                type="text"
                value={manualCat}
                onChange={(e) => setManualCat(e.target.value)}
                placeholder="Ex: Tecnologia"
                className="h-8 text-xs bg-card"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Subcategoria</label>
              <Input
                type="text"
                value={manualSub}
                onChange={(e) => setManualSub(e.target.value)}
                placeholder="Ex: Licenciamento"
                className="h-8 text-xs bg-card"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Grupo Gerencial</label>
              <Input
                type="text"
                value={manualGrp}
                onChange={(e) => setManualGrp(e.target.value)}
                placeholder="Ex: OPEX"
                className="h-8 text-xs bg-card"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Centro de Receita</label>
              <Input
                type="text"
                value={manualCr}
                onChange={(e) => setManualCr(e.target.value)}
                placeholder="Ex: TI"
                className="h-8 text-xs bg-card"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsAdjusting(false)}
              className="h-8 text-xs"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={feedbackStatus === "loading"}
              className="h-8 text-xs bg-primary hover:bg-primary/95 text-primary-foreground"
            >
              <Save className="h-3 w-3 mr-1" />
              Salvar Classificação
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
