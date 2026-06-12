import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useTenantStore } from "@/store/useTenantStore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldAlert, Cpu, ArrowRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePageComponent,
});

function AcceptInvitePageComponent() {
  const navigate = useNavigate();
  const { user, session, loading: authLoading, checkSession } = useAuthStore();
  const { fetchTenantData, setActiveGroup, groups } = useTenantStore();
  
  const [token, setToken] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Get token from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const tokenParam = searchParams.get("token");
    setToken(tokenParam);
    if (!tokenParam) {
      setErrorMsg("Token de convite não encontrado na URL.");
    }
  }, []);

  // Ensure session is initialized
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // If not logged in, redirect to login with redirectTo parameter
  useEffect(() => {
    if (!authLoading && !user && token) {
      const currentPath = encodeURIComponent(`/accept-invite?token=${token}`);
      toast.info("Por favor, faça login ou cadastre-se para aceitar o convite.");
      navigate({ to: `/login?redirectTo=${currentPath}` });
    }
  }, [user, authLoading, token, navigate]);

  const handleAcceptInvite = async () => {
    if (!token || !user) return;

    setAccepting(true);
    setErrorMsg(null);

    try {
      // Record previous groups to identify which group was joined
      const previousGroupIds = groups.map(g => g.id);

      // Call accept invitation RPC
      const { data, error } = await supabase.rpc("accept_group_invitation", {
        invite_token: token,
        user_uuid: user.id
      });

      if (error) throw error;

      if (data === true) {
        setSuccess(true);
        toast.success("Convite aceito com sucesso! Bem-vindo ao grupo.");
        
        // Fetch new group list
        await fetchTenantData();
        
        // Find newly joined group
        const updatedGroups = useTenantStore.getState().groups;
        const newlyJoinedGroup = updatedGroups.find(g => !previousGroupIds.includes(g.id)) || updatedGroups[0];
        
        if (newlyJoinedGroup) {
          // Switch to new active group (clears IndexDB and syncs)
          await setActiveGroup(newlyJoinedGroup);
        }

        // Redirect to dashboard
        setTimeout(() => {
          navigate({ to: "/" });
        }, 2000);
      } else {
        setErrorMsg("Este convite é inválido, expirou ou já foi aceito.");
        toast.error("Não foi possível aceitar o convite.");
      }
    } catch (err: any) {
      console.error("Erro ao aceitar convite:", err);
      setErrorMsg(err.message || "Erro desconhecido ao aceitar convite.");
      toast.error("Erro ao processar o convite.");
    } finally {
      setAccepting(false);
    }
  };

  const isLoading = authLoading || accepting;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/5 mb-3">
            <Cpu className="h-6 w-6 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Smart Fiscal Desk</h2>
          <p className="text-xs text-slate-400 mt-1">Plataforma SaaS Multi-Empresas</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-400" />
              Convite de Colaboração
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Você foi convidado para acessar e operar uma empresa ou grupo fiscal.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pb-6 pt-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400">Processando convite...</p>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-sm font-semibold text-white">Convite Aceito!</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Você foi vinculado ao grupo com sucesso. Redirecionando para o painel de controle...
                </p>
              </div>
            ) : errorMsg ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-xs text-red-300">
                <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Ops! Ocorreu um problema:</span>
                  {errorMsg}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Olá, <span className="font-semibold text-indigo-400">{user?.email}</span>. Ao aceitar este convite, você terá acesso compartilhado aos documentos fiscais e às configurações deste grupo de acordo com as permissões atribuídas.
                </p>
                <Button
                  onClick={handleAcceptInvite}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl h-10 text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  Aceitar Convite e Entrar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t border-slate-800/80 bg-slate-950/40 px-6 py-4 flex justify-between text-xs">
            <span className="text-slate-500">Token verificado via RLS</span>
            {user && (
              <button 
                onClick={() => navigate({ to: "/" })}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Voltar ao Painel
              </button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
