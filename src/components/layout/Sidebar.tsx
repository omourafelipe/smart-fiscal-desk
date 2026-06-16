import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Settings } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notas", label: "Notas", icon: FileText },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/40 flex flex-col">
      <div className="h-14 flex items-center px-5 border-b border-border">
        <span className="font-bold text-sm tracking-tight">Smart Fiscal Desk</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-[10px] text-muted-foreground/70">
        Modo local · v1
      </div>
    </aside>
  );
}
