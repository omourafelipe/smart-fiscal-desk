import { useState, useMemo } from "react";
import { 
  Calendar, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  TributoObrigacao, 
  obterConfigsIss, 
  salvarConfigsIss, 
  IssDeadlineConfig 
} from "@/lib/obrigacoes";
import { toast } from "sonner";

interface UpcomingObligationsWidgetProps {
  obligations: TributoObrigacao[];
  onConfigChange: () => void;
  uniqueMuniCodes: string[];
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function UpcomingObligationsWidget({
  obligations,
  onConfigChange,
  uniqueMuniCodes,
}: UpcomingObligationsWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [issConfigs, setIssConfigs] = useState<Record<string, IssDeadlineConfig>>({});

  // Filter obligations to only show those due in the next 30 days (or already past due)
  const filteredObligations = useMemo(() => {
    return obligations.filter((o) => o.diasParaVencer <= 30);
  }, [obligations]);

  // Load configs when opening the modal
  const handleOpenConfigs = () => {
    const currentConfigs = obterConfigsIss();
    
    // Ensure all unique municipal codes present have a config entry
    const updatedConfigs = { ...currentConfigs };
    uniqueMuniCodes.forEach((code) => {
      if (!updatedConfigs[code]) {
        updatedConfigs[code] = {
          codigo: code,
          nome: `Código ${code}`,
          diaVencimento: 10,
        };
      }
    });

    setIssConfigs(updatedConfigs);
    setIsModalOpen(true);
  };

  const handleSaveConfigs = () => {
    salvarConfigsIss(issConfigs);
    setIsModalOpen(false);
    toast.success("Configurações de vencimento do ISS salvas com sucesso!");
    onConfigChange(); // Notify parent to recalculate obligations
  };

  const handleUpdateConfig = (code: string, field: keyof IssDeadlineConfig, value: any) => {
    setIssConfigs((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col h-full transition-colors duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
            Próximas Obrigações
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Guias de tributos a vencer nos próximos 30 dias
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenConfigs}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
          title="Configurar Vencimentos do ISS"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      {/* LIST CONTENT */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[200px] md:max-h-[220px]">
        {filteredObligations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/80 mb-2" />
            <p className="text-xs font-semibold text-foreground/80">Tudo em dia!</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Nenhuma obrigação identificada nos próximos 30 dias.
            </p>
          </div>
        ) : (
          filteredObligations.map((ob) => {
            // Determine status badge colors
            let badgeVariant = "secondary";
            let badgeClass = "bg-muted text-muted-foreground border-transparent";
            let badgeText = `Vence em ${ob.diasParaVencer}d`;

            if (ob.status === "vencido") {
              badgeClass = "bg-rose-500/10 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
              badgeText = `Vencido há ${Math.abs(ob.diasParaVencer)}d`;
            } else if (ob.status === "vence_hoje") {
              badgeClass = "bg-amber-500/10 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 animate-pulse";
              badgeText = "Vence Hoje";
            } else if (ob.diasParaVencer === 1) {
              badgeClass = "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50";
              badgeText = "Vence Amanhã";
            }

            const isFederal = ob.tipo === "PIS/COFINS" || ob.tipo === "CSLL/IRRF" || ob.tipo === "INSS";

            return (
              <div
                key={ob.id}
                className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${
                    isFederal 
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                      : "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                  }`}>
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate" title={ob.descricao}>
                      {ob.descricao}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={ob.empresaNome}>
                      Ref: {ob.competencia} · {ob.empresaNome}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-mono text-muted-foreground">
                        Vencto: {ob.dataVencimento.split("-").reverse().join("/")}
                      </span>
                      <Badge variant="outline" className={`text-[8px] font-semibold px-1.5 py-0.2 rounded-md ${badgeClass}`}>
                        {badgeText}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {fmtBRL(ob.valor)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONFIG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-indigo-500" />
                  Configurar Dia de Vencimento do ISS
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Defina o dia útil de vencimento mensal do ISS para cada município.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {uniqueMuniCodes.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Nenhum código municipal identificado nas notas importadas.
                </div>
              ) : (
                <div className="space-y-4">
                  {uniqueMuniCodes.map((code) => {
                    const config = issConfigs[code] || { codigo: code, nome: `Código ${code}`, diaVencimento: 10 };
                    return (
                      <div 
                        key={code} 
                        className="grid grid-cols-12 gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 items-center"
                      >
                        {/* Municipal Code */}
                        <div className="col-span-3 text-[10px] font-mono text-muted-foreground">
                          Código: {code}
                        </div>

                        {/* Custom Name / Label */}
                        <div className="col-span-6">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase block mb-1">
                            Nome do Município
                          </label>
                          <Input
                            placeholder="Ex: São Paulo"
                            value={config.nome}
                            onChange={(e) => handleUpdateConfig(code, "nome", e.target.value)}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        {/* Due Day */}
                        <div className="col-span-3">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase block mb-1">
                            Dia do Vencimento
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={config.diaVencimento}
                            onChange={(e) => handleUpdateConfig(code, "diaVencimento", parseInt(e.target.value) || 10)}
                            className="h-8 text-xs rounded-lg font-mono text-center"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveConfigs}
                className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs cursor-pointer"
              >
                Salvar Configurações
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
