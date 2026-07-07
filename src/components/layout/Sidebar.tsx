import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Settings, BarChart3, Tag } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notas", label: "Notas Fiscais", icon: FileText },
  { to: "/classificacao", label: "Regras & Classificação", icon: Tag },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="exec-sidebar">
      {/* Logo / Brand */}
      <div className="exec-sidebar-logo">
        <div className="exec-sidebar-logo-icon">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-white leading-tight">Smart Fiscal</div>
          <div className="text-[10px] font-medium" style={{ color: "oklch(0.55 0.04 255)" }}>Desk · Analytics</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="exec-sidebar-nav">
        <div className="px-2 mb-3 mt-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "oklch(0.45 0.03 255)" }}>
            Menu
          </span>
        </div>
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`exec-nav-item${active ? " active" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="exec-sidebar-footer">
        <div className="text-[11px] font-medium" style={{ color: "oklch(0.45 0.03 255)" }}>
          Modo local · v2.0
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.38 0.025 255)" }}>
          Dados processados localmente
        </div>
      </div>
    </aside>
  );
}
