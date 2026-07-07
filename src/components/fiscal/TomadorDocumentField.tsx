import { useEffect } from "react";
import { useDocumentDetection } from "@/hooks/useDocumentDetection";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, AlertCircle, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TomadorDocumentFieldProps {
  initialValue?: string;
  onDocumentChange?: (doc: {
    raw: string;
    formatted: string;
    isValid: boolean;
    type: 'CPF' | 'CNPJ' | 'Desconhecido';
    name?: string;
  }) => void;
}

// Função de máscara dinâmica para CPF/CNPJ em tempo real
const applyMask = (value: string): string => {
  const clean = value.replace(/\D/g, "");
  
  if (clean.length <= 11) {
    // Máscara CPF: 000.000.000-00
    let val = clean;
    if (val.length > 9) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9, 11)}`;
    } else if (val.length > 6) {
      val = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6)}`;
    } else if (val.length > 3) {
      val = `${val.slice(0, 3)}.${val.slice(3)}`;
    }
    return val;
  } else {
    // Máscara CNPJ: 00.000.000/0000-00
    let val = clean.slice(0, 14);
    if (val.length > 12) {
      val = `${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5, 8)}/${val.slice(8, 12)}-${val.slice(12, 14)}`;
    } else if (val.length > 8) {
      val = `${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5, 8)}/${val.slice(8)}`;
    } else if (val.length > 5) {
      val = `${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5)}`;
    } else if (val.length > 2) {
      val = `${val.slice(0, 2)}.${val.slice(2)}`;
    }
    return val;
  }
};

export function TomadorDocumentField({
  initialValue = "",
  onDocumentChange,
}: TomadorDocumentFieldProps) {
  const {
    value,
    setValue,
    loading,
    error,
    result,
    retry,
  } = useDocumentDetection(initialValue);

  // Propaga as mudanças para o componente pai quando houver atualização na validação
  useEffect(() => {
    if (onDocumentChange) {
      if (result) {
        onDocumentChange({
          raw: result.documento,
          formatted: result.formatado,
          isValid: result.valido,
          type: result.tipo,
          name: result.nome_sugerido,
        });
      } else {
        onDocumentChange({
          raw: value.replace(/\D/g, ""),
          formatted: value,
          isValid: false,
          type: "Desconhecido",
        });
      }
    }
  }, [result, value, onDocumentChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.replace(/\D/g, "");
    
    // Limita tamanho total do documento (CPF/CNPJ) para 14 dígitos
    if (cleanVal.length <= 14) {
      setValue(applyMask(rawVal));
    }
  };

  const getCleanLength = () => value.replace(/\D/g, "").length;

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-blue-500" />
        </div>
        
        <Input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)"
          className="pl-9 pr-10 py-5 text-sm bg-card border-border hover:border-border/80 focus:ring-blue-500 rounded-xl transition-all font-mono"
        />

        {/* Indicador de Carregamento da Validação */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Cenário de Erro de Conexão (10% simulado) */}
      {error && (
        <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-2.5 animate-in fade-in duration-300">
          <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Serviço de validação indisponível</div>
            <div className="text-[10px] text-muted-foreground">{error}</div>
            <div className="flex gap-2 pt-0.5">
              <Button size="sm" variant="ghost" onClick={retry} className="h-6 text-[9px] p-0 underline text-rose-600 dark:text-rose-400">
                Tentar novamente
              </Button>
              <span className="text-[9px] text-muted-foreground mt-1">| Digitação manual liberada.</span>
            </div>
          </div>
        </div>
      )}

      {/* Documento Inválido (após finalizar a digitação e rodar a validação) */}
      {result && !result.valido && !loading && !error && getCleanLength() > 0 && (
        <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-2 animate-in fade-in duration-300">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Dígitos verificadores do {result.tipo} inválidos. Verifique os números digitados.
          </span>
        </div>
      )}

      {/* Documento Válido e Nome Sugerido */}
      {result && result.valido && !loading && !error && (
        <div className="p-3.5 border border-emerald-500/20 bg-emerald-500/5 rounded-xl space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 font-mono">
                {result.formatado}
              </span>
            </div>
            
            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/10 font-mono text-[9px]">
              {result.tipo} Válido
            </Badge>
          </div>

          {result.nome_sugerido && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card px-2.5 py-1.5 rounded-lg border border-border/60">
              <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium text-foreground truncate">{result.nome_sugerido}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">(Cadastro Federal)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
