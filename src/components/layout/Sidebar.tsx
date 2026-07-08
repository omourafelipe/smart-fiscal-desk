import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Settings, BarChart3, Tag, Calculator, Briefcase, Users, AlertTriangle, Building2 } from "lucide-react";

const dashItems = [
  { to: "/", label: "Dashboard Executivo", icon: LayoutDashboard },
  { to: "/comercial", label: "Dashboard Comercial", icon: BarChart3 },
  { to: "/clientes", label: "Dashboard de Clientes", icon: Users },
  { to: "/servicos", label: "Dashboard de Serviços", icon: Briefcase },
  { to: "/tributario", label: "Dashboard Tributário", icon: Calculator },
  { to: "/fiscal", label: "Dashboard Fiscal", icon: AlertTriangle },
] as const;

const dataItems = [
  { to: "/notas", label: "Notas Fiscais", icon: FileText },
  { to: "/classificacao", label: "Regras & Classificação", icon: Tag },
  { to: "/empresas", label: "Empresas", icon: Building2 },
] as const;

const reportItems = [
  { to: "/relatorio-cliente", label: "Faturamento por Cliente", icon: FileText },
] as const;

const settingItems = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const renderNavGroup = (title: string, items: readonly { readonly to: string; readonly label: string; readonly icon: any }[]) => (
    <div className="space-y-1">
      <div className="px-2 py-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 opacity-80">
          {title}
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
    </div>
  );

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
      <nav className="exec-sidebar-nav space-y-4">
        {renderNavGroup("Dashboards", dashItems)}
        {renderNavGroup("Dados & Regras", dataItems)}
        {renderNavGroup("Relatórios", reportItems)}
        {renderNavGroup("Ajustes", settingItems)}
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
