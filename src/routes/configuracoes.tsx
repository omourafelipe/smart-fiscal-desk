import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useTenantStore, type GroupMember, type GroupInvitation, type Company } from "@/store/useTenantStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Building, Plus, Trash2, Mail, Copy, Shield, Settings, Key, UserCheck, 
  ShieldAlert, LogOut, Check, Loader2, AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesRouteComponent,
});

function formatarCnpjCpf(val: string) {
  const clean = String(val ?? "").replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return val;
}

function formatarData(dataStr?: string) {
  if (!dataStr) return "—";
  try {
    const clean = dataStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case "Owner":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/25";
    case "Administrador":
      return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/25";
    case "Analista":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25";
    default:
      return "bg-slate-500/10 text-slate-400 border border-slate-500/25";
  }
}

function ConfiguracoesRouteComponent() {
  const navigate = useNavigate();
  const { user, session, checkSession } = useAuthStore();
  const { 
    groups, 
    activeGroup, 
    activeRole, 
    companies, 
    members, 
    invitations, 
    loading,
    fetchTenantData,
    createInvitation,
    cancelInvitation,
    changeMemberRole,
    removeMember,
    createCompany,
    deleteCompany
  } = useTenantStore();

  // New item states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<GroupInvitation['role']>("Analista");
  const [companyNome, setCompanyNome] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [groupNome, setGroupNome] = useState("");
  
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto check session
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Load tenant data on mount
  useEffect(() => {
    if (user) {
      fetchTenantData();
    }
  }, [user, fetchTenantData]);

  // Sync group name state when active group changes
  useEffect(() => {
    if (activeGroup) {
      setGroupNome(activeGroup.nome);
    }
  }, [activeGroup]);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!session && !user) {
      navigate({ to: "/login" });
    }
  }, [session, user, navigate]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Por favor, preencha o email do convidado.");
      return;
    }

    setSubmitting(true);
    const invite = await createInvitation(inviteEmail.trim(), inviteRole);
    setSubmitting(false);

    if (invite) {
      setInviteEmail("");
      // Generate invite link for visual utility since SMTP is disabled
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
      const inviteUrl = `${origin}/accept-invite?token=${invite.token}`;
      
      // Let user copy the link immediately
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Link do convite copiado para a área de transferência!");
      } catch {
        // Fallback
      }
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyNome.trim() || !companyCnpj.trim()) {
      toast.error("Por favor, preencha o nome e CNPJ da empresa.");
      return;
    }

    const cleanCnpj = companyCnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ deve conter 14 dígitos.");
      return;
    }

    setSubmitting(true);
    const comp = await createCompany(companyNome.trim(), cleanCnpj);
    setSubmitting(false);

    if (comp) {
      setCompanyNome("");
      setCompanyCnpj("");
    }
  };

  const handleUpdateGroupName = async () => {
    if (!activeGroup || !groupNome.trim()) return;

    setSubmitting(true);
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("groups")
        .update({ nome: groupNome.trim() })
        .eq("id", activeGroup.id);

      if (error) throw error;
      toast.success("Nome do grupo atualizado com sucesso!");
      await fetchTenantData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar nome do grupo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (token: string, inviteId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
    const inviteUrl = `${origin}/accept-invite?token=${token}`;
    
    navigator.clipboard.writeText(inviteUrl);
    setCopiedTokenId(inviteId);
    toast.success("Link do convite copiado!");
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // Permission Checks
  const isOwner = activeRole === "Owner";
  const isAdmin = activeRole === "Administrador" || isOwner;
  const isAnalista = activeRole === "Analista" || isAdmin;

  return (
    <main className="flex-1 p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-indigo-500" />
            Configurações e Permissões
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Gerencie membros do grupo, empresas associadas, convites e permissões do Smart Fiscal Desk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${getRoleColor(activeRole || "Visualizador")} font-semibold px-2.5 py-1 text-xs`}>
            Papel: {activeRole || "Sem Acesso"}
          </Badge>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {/* KPI Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Membros Ativos</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{members.filter(m => m.status === 'active').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Convites Pendentes</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{invitations.filter(i => i.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Empresas do Grupo</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-foreground">{companies.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Grupo Fiscal Ativo</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold text-indigo-400 truncate" title={activeGroup?.nome || "Sem Grupo"}>
              {activeGroup?.nome || "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="membros" className="w-full space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl w-full sm:w-auto flex overflow-x-auto gap-1">
          <TabsTrigger value="membros" className="text-xs rounded-lg cursor-pointer py-1.5 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Membros ({members.length})
          </TabsTrigger>
          <TabsTrigger value="convites" className="text-xs rounded-lg cursor-pointer py-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Convites Pendentes ({invitations.filter(i => i.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="empresas" className="text-xs rounded-lg cursor-pointer py-1.5 flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5" />
            Empresas ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="geral" className="text-xs rounded-lg cursor-pointer py-1.5 flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Geral / Administrador
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="membros" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Invite Form (Admins/Owners only) */}
            <Card className="border-border bg-card lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                  Convidar Novo Usuário
                </CardTitle>
                <CardDescription className="text-xs">
                  Convide colaboradores enviando um link de acesso com permissões específicas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isAdmin ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                    <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>Apenas Proprietários e Administradores podem convidar usuários.</span>
                  </div>
                ) : (
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-slate-300">Email do Convidado</Label>
                      <Input
                        id="email"
                        placeholder="email@empresa.com"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-slate-950/40 border-slate-800 text-white text-xs rounded-xl focus-visible:ring-indigo-500/30"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="role" className="text-xs font-semibold text-slate-300">Papel / Nível de Acesso</Label>
                      <Select 
                        value={inviteRole} 
                        onValueChange={(val) => setInviteRole(val as GroupInvitation['role'])}
                      >
                        <SelectTrigger className="bg-slate-950/40 border-slate-800 text-white text-xs rounded-xl cursor-pointer">
                          <SelectValue placeholder="Selecione um papel" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border rounded-xl">
                          <SelectItem value="Administrador">Administrador (Gestão total)</SelectItem>
                          <SelectItem value="Analista">Analista (Importar XML, categorizar)</SelectItem>
                          <SelectItem value="Visualizador">Visualizador (Somente visualização)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer mt-2"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Gerar Link de Convite
                    </Button>
                  </form>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 border-t border-border/20 text-[10px] text-muted-foreground p-4">
                Como o envio de e-mails está suspenso, a geração do convite fornecerá um link seguro para você copiar e enviar via Whatsapp ou chat.
              </CardFooter>
            </Card>

            {/* Members List Table */}
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-400" />
                  Membros do Grupo
                </CardTitle>
                <CardDescription className="text-xs">
                  Lista de usuários vinculados que possuem permissão de acesso ao grupo atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border">
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Membro</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Papel</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Adesão</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id} className="border-b border-border/50 hover:bg-muted/20">
                        <TableCell>
                          <div className="font-semibold text-foreground text-xs">
                            {member.profiles?.nome || "Carregando..."}
                            {member.user_id === user?.id && " (Você)"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{member.profiles?.email}</div>
                        </TableCell>
                        <TableCell>
                          {isOwner && member.user_id !== user?.id ? (
                            <Select
                              defaultValue={member.role}
                              onValueChange={async (newRole) => {
                                const ok = await changeMemberRole(member.id, newRole as GroupMember['role']);
                                if (ok) toast.success("Papel alterado!");
                              }}
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs bg-muted/50 border-border rounded-lg cursor-pointer">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border text-xs rounded-lg">
                                <SelectItem value="Owner">Proprietário (Owner)</SelectItem>
                                <SelectItem value="Administrador">Administrador</SelectItem>
                                <SelectItem value="Analista">Analista</SelectItem>
                                <SelectItem value="Visualizador">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`${getRoleColor(member.role)} text-[10px] font-semibold px-2 py-0.5`}>
                              {member.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formatarData(member.accepted_at || member.invited_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={member.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px]'}>
                            {member.status === 'active' ? 'Ativo' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isOwner && member.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (confirm(`Deseja remover ${member.profiles?.nome || "este membro"} do grupo?`)) {
                                  await removeMember(member.id);
                                }
                              }}
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="convites">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-400" />
                Convites Gerados e Pendentes
              </CardTitle>
              <CardDescription className="text-xs">
                Acompanhe o status dos convites pendentes e copie os links de adesão gerados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border">
                    <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Email</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Papel Convidado</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Expira em</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-9 text-xs font-mono">Status</TableHead>
                    <TableHead className="font-semibold text-muted-foreground h-9 text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">
                        Nenhum convite pendente ou gerado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((invite) => (
                      <TableRow key={invite.id} className="border-b border-border/50 hover:bg-muted/20">
                        <TableCell>
                          <div className="font-semibold text-foreground text-xs">{invite.email}</div>
                          <div className="text-[9px] text-muted-foreground font-mono mt-0.5">Token: {invite.token.substring(0, 8)}...</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getRoleColor(invite.role)} text-[10px]`}>{invite.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formatarData(invite.expires_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={invite.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px]' : invite.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]' : 'bg-red-500/10 text-red-400 border border-red-500/20 text-[9px]'}>
                            {invite.status === 'pending' ? 'Pendente' : invite.status === 'accepted' ? 'Aceito' : invite.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {invite.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyLink(invite.token, invite.id)}
                                  className="h-8 text-xs border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white rounded-lg cursor-pointer flex items-center gap-1"
                                >
                                  {copiedTokenId === invite.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  {copiedTokenId === invite.id ? "Copiado!" : "Copiar Link"}
                                </Button>
                                
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => cancelInvitation(invite.id)}
                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="empresas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Create Company Form */}
            <Card className="border-border bg-card lg:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Building className="h-4 w-4 text-indigo-400" />
                  Adicionar Empresa ao Grupo
                </CardTitle>
                <CardDescription className="text-xs">
                  Associe uma nova pessoa jurídica para agregar seus XMLs fiscais e emitidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isAdmin ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                    <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>Apenas Proprietários e Administradores podem adicionar empresas.</span>
                  </div>
                ) : (
                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className="text-xs font-semibold text-slate-300">Razão Social / Nome Fantasia</Label>
                      <Input
                        id="companyName"
                        placeholder="Ex: Minha Empresa Fictícia Ltda"
                        value={companyNome}
                        onChange={(e) => setCompanyNome(e.target.value)}
                        className="bg-slate-950/40 border-slate-800 text-white text-xs rounded-xl focus-visible:ring-indigo-500/30"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="companyCnpj" className="text-xs font-semibold text-slate-300">CNPJ da Empresa</Label>
                      <Input
                        id="companyCnpj"
                        placeholder="00.000.000/0000-00"
                        value={companyCnpj}
                        onChange={(e) => setCompanyCnpj(e.target.value)}
                        className="bg-slate-950/40 border-slate-800 text-white text-xs rounded-xl focus-visible:ring-indigo-500/30"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer mt-2"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Cadastrar Empresa
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Companies List Table */}
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Building className="h-4 w-4 text-indigo-400" />
                  Empresas Cadastradas ({companies.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Lista de filiais ou empresas do mesmo grupo econômico vinculadas a esta assinatura.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border">
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Nome / Razão Social</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">CNPJ</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs">Data de Adição</TableHead>
                      <TableHead className="font-semibold text-muted-foreground h-9 text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-xs text-muted-foreground">
                          Nenhuma empresa cadastrada para este grupo. Adicione acima.
                        </TableCell>
                      </TableRow>
                    ) : (
                      companies.map((company) => (
                        <TableRow key={company.id} className="border-b border-border/50 hover:bg-muted/20">
                          <TableCell className="font-semibold text-foreground text-xs">
                            {company.nome}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground/80">
                            {formatarCnpjCpf(company.cnpj)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {formatarData(company.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (confirm(`Deseja mesmo remover a empresa ${company.nome}? Notas vinculadas a este CNPJ serão mantidas, mas sem a empresa correspondente no cadastro.`)) {
                                    await deleteCompany(company.id);
                                  }
                                }}
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* General Admin Settings Tab */}
        <TabsContent value="geral">
          <Card className="border-border bg-card max-w-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-indigo-400" />
                Configurações Gerais do Grupo
              </CardTitle>
              <CardDescription className="text-xs">
                Modifique as configurações de governança do seu grupo de empresas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="groupName" className="text-xs font-semibold text-slate-300">Nome do Grupo Econômico</Label>
                <div className="flex gap-2">
                  <Input
                    id="groupName"
                    value={groupNome}
                    disabled={!isOwner}
                    onChange={(e) => setGroupNome(e.target.value)}
                    className="bg-slate-950/40 border-slate-800 text-white text-xs rounded-xl focus-visible:ring-indigo-500/30"
                  />
                  {isOwner && (
                    <Button 
                      onClick={handleUpdateGroupName}
                      disabled={submitting || !groupNome.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      Renomear
                    </Button>
                  )}
                </div>
                {!isOwner && (
                  <p className="text-[10px] text-amber-400/80 mt-1">
                    Apenas o Proprietário ({activeGroup ? members.find(m => m.user_id === activeGroup.owner_user_id)?.profiles?.nome : "dono"}) pode renomear o grupo.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-border/60 space-y-2.5">
                <Label className="text-xs font-semibold text-slate-300">Dados do Tenant (Isolamento)</Label>
                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400 leading-relaxed font-mono bg-slate-950/40 p-4 rounded-xl border border-border/40">
                  <div>
                    <span className="text-slate-500 block">Identificador do Grupo (Tenant ID):</span>
                    <span className="text-indigo-400 font-semibold">{activeGroup?.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data de Criação do Tenant:</span>
                    <span>{formatarData(activeGroup?.created_at)}</span>
                  </div>
                  <div className="col-span-2 mt-2 pt-2 border-t border-border/20">
                    <span className="text-slate-500 block">Proprietário Responsável (Owner UUID):</span>
                    <span>{activeGroup?.owner_user_id}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex gap-3 text-xs text-indigo-300/95 leading-relaxed mt-4">
                <Shield className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Garantia de Isolamento de Dados:</span>
                  Toda a segurança de dados desta plataforma é garantida por meio de Políticas RLS (Row Level Security) diretamente no banco de dados. Os analistas e visualizadores de outros grupos jamais conseguirão ler ou alterar dados pertencentes a este ID de grupo.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
