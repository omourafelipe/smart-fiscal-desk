import { useNavigate, useSearch, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  Star,
  Search,
  Moon,
  Sun,
  Clock,
  Bell,
  LayoutDashboard,
} from "lucide-react";
import { useLayoutShell } from "./LayoutShell";

interface TopbarProps {
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
}

export function Topbar({ rightPanelOpen, setRightPanelOpen }: TopbarProps) {
  const {
    theme,
    toggleTheme,
    activities,
    addActivity,
    setSidebarOpen,
  } = useLayoutShell();

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();

  const searchCliente = search.searchCliente || "";
  const setSearchCliente = (val: string) => {
    navigate({
      search: (prev: any) => ({ ...prev, searchCliente: val || undefined }),
    } as any);
  };

  const getTitle = (path: string) => {
    switch (path) {
      case "/":
        return "Faturamento Geral";
      case "/grupo":
        return "Resumo do Grupo";
      case "/tomados":
        return "Serviços Tomados";
      case "/conciliation":
        return "Validador Planilhas";
      case "/categorias":
        return "Categorias de Serviço";
      default:
        return "Dashboard Fiscal";
    }
  };

  return (
    <header className="h-14 bg-card/85 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-20 flex-shrink-0 transition-colors duration-300">
      {/* Header Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>
        <button className="text-muted-foreground/45 hover:text-amber-400 transition-colors hidden sm:block cursor-pointer">
          <Star className="h-4 w-4 fill-current text-muted-foreground/30" />
        </button>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Dashboards</span>
          <span>/</span>
          <span className="text-foreground font-semibold">
            {getTitle(currentPath)}
          </span>
        </div>
      </div>

      {/* Header Right */}
      <div className="flex items-center gap-3">
        {/* Search Input synced with URL Search Params */}
        <div className="relative w-48 lg:w-64 hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente ou nº NFS..."
            value={searchCliente}
            onChange={(e) => setSearchCliente(e.target.value)}
            className="w-full h-8 pl-8 pr-10 rounded-lg bg-muted border border-border text-xs focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
          />
          <span className="absolute right-2.5 top-2 text-[9px] font-mono text-muted-foreground bg-muted-foreground/15 px-1 rounded-md">
            ⌘/
          </span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={theme === "light" ? "Modo Escuro" : "Modo Claro"}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        {/* Utility Icon */}
        <button
          onClick={() => addActivity("update", "Preferências Atualizadas", "O usuário atualizou as preferências do sistema.")}
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Verificar Atualização"
        >
          <Clock className="h-4 w-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative cursor-pointer"
          title="Logs de Atividade"
        >
          <Bell className="h-4 w-4" />
          {activities.length > 1 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
          )}
        </button>

        {/* Dashboard layout toggler */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hidden md:flex cursor-pointer"
          title="Ver Atividades"
        >
          <LayoutDashboard className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
