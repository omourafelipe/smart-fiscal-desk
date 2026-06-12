import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sparkles,
  Database,
  Building2,
  ShoppingBag,
  FileSpreadsheet,
  Filter,
  Download,
  Trash2,
  Settings,
  Users,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useLayoutShell } from "./LayoutShell";
import { useAuthStore } from "@/store/useAuthStore";
import { useTenantStore } from "@/store/useTenantStore";

export function Sidebar() {
  const {
    sidebarOpen,
    periodType,
    setPeriodType,
    addActivity,
  } = useLayoutShell();

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();

  const { user, profile, signOut } = useAuthStore();
  const { groups, activeGroup, setActiveGroup, activeRole } = useTenantStore();

  // Retrieve global counts from IndexedDB for sidebar badges
  const totalNotasEmitidas = useLiveQuery(() => db.notas.count()) ?? 0;
  const totalNotasTomadas = useLiveQuery(() => db.notasTomadas.count()) ?? 0;

  const clearDb = async () => {
    if (confirm("Deseja realmente limpar toda a base local de notas fiscais?")) {
      await Promise.all([db.notas.clear(), db.notasTomadas.clear()]);
      addActivity("clear", "Base de Dados Limpa", "Todas as notas emitidas e tomadas foram removidas.");
      toast.success("Base de dados local limpa.");
    }
  };

  const exportAllNotasCsv = async () => {
    const notas = await db.notas.toArray();
    if (!notas.length) {
      toast.error("Nenhuma nota cadastrada para exportação.");
      return;
    }
    const headers = ["Chave", "Número", "CNPJ Prestador", "Nome Prestador", "Emissão", "Valor", "Cliente", "Status"];
    const rows = notas.map((n) => [
      n.chave,
      n.nNFSe,
      n.cnpjPrestador,
      n.nomePrestador,
      n.dhEmi,
      n.valor,
      n.cliente,
      n.status || "válida",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_geral_notas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-card border-r border-border flex flex-col justify-between transition-all duration-300 ease-in-out md:static flex-shrink-0 ${
        sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:border-r-0 overflow-hidden"
      }`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto px-5 py-6 gap-6">
        {/* Logo & Header */}
        <div className="flex items-center gap-3 px-1">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground leading-none">Smart Fiscal</h2>
            <span className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Diretoria BI</span>
          </div>
        </div>

        {/* User Profile Info */}
        {user ? (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/60 border border-border/40 mt-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {(profile?.nome || user?.email || "U").substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{profile?.nome || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            
            {groups.length > 1 ? (
              <div className="mt-1 pt-1.5 border-t border-border/40">
                <label className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Grupo / Empresa Activa
                </label>
                <select
                  value={activeGroup?.id || ""}
                  onChange={async (e) => {
                    const selected = groups.find(g => g.id === e.target.value);
                    if (selected) {
                      await setActiveGroup(selected);
                    }
                  }}
                  className="w-full bg-slate-950/40 border border-slate-800 text-foreground text-[10px] rounded-lg p-1 font-semibold focus:outline-none"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              activeGroup && (
                <div className="text-[9px] text-indigo-400 font-semibold mt-1">
                  Grupo: {activeGroup.nome}
                </div>
              )
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-dashed border-border/60 hover:bg-muted/60 hover:border-indigo-500/40 mt-2 transition-all group"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20">
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">Conectar em Nuvem</p>
              <p className="text-[9px] text-muted-foreground">Sincronizar e compartilhar</p>
            </div>
          </Link>
        )}

        {/* Regime de Data (Competência vs Emissão) */}
        <div className="flex flex-col gap-2 px-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Regime de Data</span>
          <div className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl border border-border/40">
            <button
              onClick={() => {
                setPeriodType("competencia");
                addActivity("update", "Regime Alterado: Competência", "Cálculos parametrizados pela data de Competência.");
                toast.info("Regime de Data: Competência");
              }}
              className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                periodType === "competencia"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Competência
            </button>
            <button
              onClick={() => {
                setPeriodType("emissao");
                addActivity("update", "Regime Alterado: Emissão", "Cálculos parametrizados pela data de Emissão.");
                toast.info("Regime de Data: Emissão");
              }}
              className={`py-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                periodType === "emissao"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Emissão
            </button>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-5 mt-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Dashboards</span>
            
            {/* Dashboard / Faturamento */}
            <Link
              to="/"
              search={(prev) => prev}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                currentPath === "/" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4" /> Faturamento
              </div>
              {totalNotasEmitidas > 0 && (
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono border border-border/40">
                  {totalNotasEmitidas}
                </span>
              )}
            </Link>

            {/* Resumo do Grupo */}
            <Link
              to="/grupo"
              search={(prev) => prev}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                currentPath === "/grupo" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4" /> Resumo do Grupo
              </div>
            </Link>

            {/* Serviços Tomados */}
            <Link
              to="/tomados"
              search={(prev) => prev}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                currentPath === "/tomados" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4" /> Serviços Tomados
              </div>
              {totalNotasTomadas > 0 && (
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-mono border border-border/40">
                  {totalNotasTomadas}
                </span>
              )}
            </Link>

            {/* Conciliador */}
            <Link
              to="/conciliation"
              search={(prev) => prev}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                currentPath === "/conciliation" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-4 w-4" /> Conciliador
              </div>
            </Link>

            {/* Categorias */}
            <Link
              to="/categorias"
              search={(prev) => prev}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                currentPath === "/categorias" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4" /> Categorias
              </div>
            </Link>

            {/* Configurações */}
            {user && (
              <Link
                to="/configuracoes"
                search={(prev) => prev}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all w-full text-left ${
                  currentPath === "/configuracoes" ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4" /> Configurações
                </div>
              </Link>
            )}
          </div>

          {/* Quick Actions Category */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Ações Rápidas</span>
            <button
              onClick={exportAllNotasCsv}
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-all w-full text-left cursor-pointer"
            >
              <Download className="h-4 w-4" /> Exportar Notas CSV
            </button>
            <button
              onClick={clearDb}
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all w-full text-left cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Limpar Base Local
            </button>

            {/* Log Out */}
            {user && (
              <button
                onClick={async () => {
                  if (confirm("Deseja sair da sua conta na nuvem? Isso removerá as notas sincronizadas localmente.")) {
                    await signOut();
                    // Clear Dexie since they are logging out
                    await Promise.all([
                      db.notas.clear(),
                      db.notasTomadas.clear(),
                      db.customCategories.clear(),
                      db.categoryOverrides.clear(),
                      db.serviceClassifications.clear(),
                      db.categoryRules.clear(),
                      db.auditLogs.clear()
                    ]);
                    toast.success("Desconectado com sucesso.");
                    navigate({ to: "/login" });
                  }
                }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10 rounded-xl transition-all w-full text-left cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Sair da Conta Cloud
              </button>
            )}
          </div>
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-medium">
        <span>v1.01 SPED</span>
        {user ? (
          <span className="bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-full text-indigo-400 font-semibold">
            SaaS Cloud
          </span>
        ) : (
          <span className="bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground">
            100% Local
          </span>
        )}
      </div>
    </aside>
  );
}
