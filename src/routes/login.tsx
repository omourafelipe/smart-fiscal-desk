import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Cpu, Check, ArrowLeft, Mail, Lock, Building, User } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPageComponent,
});

function LoginPageComponent() {
  const navigate = useNavigate();
  const { user, session, loading, signUp, signIn, checkSession, isSupabaseConfigured } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");

  // Redireciona para home se já estiver logado
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (session || user) {
      navigate({ to: "/" });
    }
  }, [session, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Por favor, preencha o email e senha.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (isRegister) {
      if (!nome.trim() || !empresa.trim()) {
        toast.error("Por favor, preencha todos os campos do cadastro.");
        return;
      }
      const success = await signUp(email, password, nome, empresa);
      if (success) {
        setIsRegister(false); // Alterna para login
        setPassword(""); // Reseta a senha para segurança
      }
    } else {
      const success = await signIn(email, password);
      if (success) {
        navigate({ to: "/" });
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />

      {/* Voltar para modo local */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Painel Local
        </Link>
      </div>

      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/5 mb-3">
            <Cpu className="h-6 w-6 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Smart Fiscal Desk</h2>
          <p className="text-xs text-slate-400 mt-1">Sua inteligência fiscal e financeira na nuvem</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden transition-all duration-300">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-white">
              {isRegister ? "Criar nova conta" : "Fazer Login"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              {isRegister
                ? "Cadastre-se para habilitar a sincronização na nuvem"
                : "Insira suas credenciais para acessar a plataforma"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pb-6">
            {!isSupabaseConfigured && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-300 leading-relaxed">
                <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Aviso:</span> O Supabase não está configurado localmente. Configure as variáveis no arquivo <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-[10px]">.env</code> para habilitar o login em nuvem.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-3.5">
              {isRegister && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nome" className="text-xs text-slate-300 font-medium">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                      <Input
                        id="nome"
                        placeholder="Ex: João da Silva"
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        disabled={loading || !isSupabaseConfigured}
                        className="pl-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500 rounded-xl h-9.5 text-xs focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="empresa" className="text-xs text-slate-300 font-medium">Empresa</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                      <Input
                        id="empresa"
                        placeholder="Nome da sua organização"
                        type="text"
                        value={empresa}
                        onChange={(e) => setEmpresa(e.target.value)}
                        disabled={loading || !isSupabaseConfigured}
                        className="pl-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500 rounded-xl h-9.5 text-xs focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs text-slate-300 font-medium">Email Corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="email"
                    placeholder="voce@empresa.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !isSupabaseConfigured}
                    className="pl-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500 rounded-xl h-9.5 text-xs focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs text-slate-300 font-medium">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Input
                    id="password"
                    placeholder="Sua senha secreta"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !isSupabaseConfigured}
                    className="pl-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500 rounded-xl h-9.5 text-xs focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !isSupabaseConfigured}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl h-9.5 text-xs transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : isRegister ? (
                  "Criar Conta"
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-slate-800/80 bg-slate-950/40 px-6 py-4 flex justify-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setEmail("");
                setPassword("");
                setNome("");
                setEmpresa("");
              }}
              disabled={loading || !isSupabaseConfigured}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors"
            >
              {isRegister
                ? "Já tem uma conta? Faça login"
                : "Não tem uma conta? Crie uma agora"}
            </button>
          </CardFooter>
        </Card>

        {/* Informações/Termos de SaaS */}
        <p className="text-[10px] text-slate-500 text-center mt-6">
          Ao utilizar a plataforma, você concorda com nossos termos. Dados sensíveis e XMLs fiscais são criptografados e isolados via regras RLS no banco de dados.
        </p>
      </div>
    </div>
  );
}
