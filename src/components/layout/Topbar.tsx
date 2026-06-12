import { useRouterState, Link } from "@tanstack/react-router";
import {
  Menu,
  Star,
  Search,
  Moon,
  Sun,
  Clock,
  Bell,
  LayoutDashboard,
  Cloud,
  CloudOff,
  LogOut,
  User as UserIcon,
  RefreshCw,
} from "lucide-react";
import { useLayoutShell } from "./LayoutShell";
import { useGlobalFilters } from "@/store/useGlobalFilters";
import { useAuthStore } from "@/store/useAuthStore";
import { SyncManager } from "@/lib/data-access/SyncManager";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

  const { searchCliente, setSearchCliente } = useGlobalFilters();
  const { session, profile, signOut, isSupabaseConfigured } = useAuthStore();

  const totalNotasEmitidas = useLiveQuery(() => db.notas.count()) ?? 0;
  const totalNotasTomadas = useLiveQuery(() => db.notasTomadas.count()) ?? 0;
  const totalDocumentos = totalNotasEmitidas + totalNotasTomadas;

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

        {/* Cloud Sync Status & User Profile Dropdown */}
        {isSupabaseConfigured && (
          <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
            {session ? (
              <>
                <button
                  onClick={() => SyncManager.syncAll(session.user.id, true)}
                  className="h-8 hover:bg-muted px-2.5 rounded-xl flex items-center gap-1.5 text-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer border border-emerald-500/10 bg-emerald-500/5"
                  title={`Sincronização em nuvem ativa. ${totalDocumentos} documentos locais estão em conformidade com a nuvem. Clique para sincronizar agora.`}
                >
                  <Cloud className="h-4.5 w-4.5" />
                  <span className="text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                    {totalDocumentos}
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 cursor-pointer hover:opacity-90 border border-border transition-all">
                      <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs uppercase">
                        {(profile?.nome || session.user.email || "U").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl border border-border shadow-lg p-1.5 bg-popover text-popover-foreground">
                    <DropdownMenuLabel className="px-2.5 py-2">
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-xs font-bold text-foreground">{profile?.nome || "Minha Conta"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{session.user.email}</p>
                        {profile?.empresa && (
                          <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded-md w-fit">
                            {profile.empresa}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-1 border-t border-border" />
                    <DropdownMenuItem
                      onClick={() => SyncManager.syncAll(session.user.id, true)}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sincronizar Agora
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-t border-border" />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg hover:bg-muted text-destructive hover:text-destructive cursor-pointer transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sair da Conta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <div className="h-8 hover:bg-muted px-2.5 rounded-xl flex items-center gap-1.5 text-slate-400 hover:text-foreground transition-all cursor-pointer border border-border/40" title={`Trabalhando em modo local (Offline). ${totalDocumentos} documentos salvos no navegador.`}>
                  <CloudOff className="h-4.5 w-4.5" />
                  <span className="text-[10px] font-bold font-mono bg-muted border border-border px-1.5 py-0.5 rounded-md text-muted-foreground">
                    {totalDocumentos}
                  </span>
                </div>
                <Link
                  to="/login"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-500/10 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
