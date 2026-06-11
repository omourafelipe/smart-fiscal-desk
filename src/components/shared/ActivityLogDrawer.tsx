import { ChevronRight } from "lucide-react";
import { useLayoutShell } from "../layout/LayoutShell";

interface ActivityLogDrawerProps {
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
}

export function ActivityLogDrawer({ rightPanelOpen, setRightPanelOpen }: ActivityLogDrawerProps) {
  const { activities } = useLayoutShell();

  return (
    <>
      {/* Overlay */}
      {rightPanelOpen && (
        <div
          onClick={() => setRightPanelOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 bg-card border-l border-border w-80 flex flex-col justify-between transition-transform duration-300 ease-in-out transform shadow-xl md:shadow-none flex-shrink-0 ${
          rightPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div>
              <h3 className="text-xs font-bold text-foreground">Alertas & Atividades</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Linha do tempo de auditorias e importações</p>
            </div>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Histórico Recente</h4>
            
            <div className="relative pl-4 border-l border-border flex flex-col gap-5">
              {activities.map((act) => {
                const colors = {
                  upload: "bg-blue-500",
                  conciliation: "bg-purple-500",
                  clear: "bg-rose-500",
                  update: "bg-emerald-500",
                };
                return (
                  <div key={act.id} className="relative group animate-in fade-in slide-in-from-top-1 duration-255">
                    {/* Timeline node */}
                    <span className={`absolute -left-[20px] top-1.5 h-2 w-2 rounded-full ring-4 ring-card ${colors[act.type] || "bg-slate-400"}`} />
                    
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground leading-tight">{act.title}</span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{act.description}</p>
                      <span className="text-[9px] text-muted-foreground/85 font-mono mt-1">
                        {act.time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Team Contacts (ByeWind style: Contacts section at the bottom) */}
          <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-border">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipe Financeira</h4>
            
            <div className="flex flex-col gap-3">
              <ContactItem name="Natali Craig" role="Contadora Líder Samel" avatarText="NC" />
              <ContactItem name="Drew Cano" role="Diretor Financeiro" avatarText="DC" />
              <ContactItem name="Orlando Diggs" role="Analista Fiscal" avatarText="OD" />
              <ContactItem name="Andi Lane" role="Auditor Externo" avatarText="AL" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border text-center text-[10px] text-muted-foreground font-medium bg-muted/20">
          Auditoria de Fechamento Executivo
        </div>
      </aside>
    </>
  );
}

function ContactItem({ name, role, avatarText }: { name: string; role: string; avatarText: string }) {
  return (
    <div className="flex items-center gap-2.5 p-1 hover:bg-muted rounded-lg transition-colors cursor-pointer">
      <div className="h-6 w-6 rounded-full bg-muted border border-border text-[9px] font-bold flex items-center justify-center text-foreground uppercase">
        {avatarText}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-foreground leading-none">{name}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5 leading-none">{role}</p>
      </div>
    </div>
  );
}
