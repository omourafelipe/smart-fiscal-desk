import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/lib/db";
import { SyncManager } from "@/lib/data-access/SyncManager";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";

export function toStoreRole(dbRole: string | null): 'Owner' | 'Admin' | 'Analyst' | 'Viewer' | null {
  if (!dbRole) return null;
  switch (dbRole) {
    case 'Owner': return 'Owner';
    case 'Administrador': return 'Admin';
    case 'Analista': return 'Analyst';
    case 'Visualizador': return 'Viewer';
    case 'Admin': return 'Admin';
    case 'Analyst': return 'Analyst';
    case 'Viewer': return 'Viewer';
    default: return null;
  }
}

export function toDbRole(storeRole: string): 'Owner' | 'Administrador' | 'Analista' | 'Visualizador' {
  switch (storeRole) {
    case 'Owner': return 'Owner';
    case 'Admin': return 'Administrador';
    case 'Analyst': return 'Analista';
    case 'Viewer': return 'Visualizador';
    case 'Administrador': return 'Administrador';
    case 'Analista': return 'Analista';
    case 'Visualizador': return 'Visualizador';
    default: return 'Visualizador';
  }
}

export interface Group {
  id: string;
  nome: string;
  owner_user_id: string;
  created_at?: string;
}

export interface Company {
  id: string;
  group_id: string;
  nome: string;
  cnpj: string;
  created_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'Owner' | 'Administrador' | 'Analista' | 'Visualizador' | 'Admin' | 'Analyst' | 'Viewer';
  invited_by?: string;
  invited_at?: string;
  accepted_at?: string;
  status: 'pending' | 'active' | 'declined';
  profiles?: {
    nome: string;
    email: string;
    avatar_url?: string;
  };
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  email: string;
  role: 'Owner' | 'Administrador' | 'Analista' | 'Visualizador' | 'Admin' | 'Analyst' | 'Viewer';
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

interface TenantState {
  groups: Group[];
  activeGroup: Group | null;
  activeRole: 'Owner' | 'Admin' | 'Analyst' | 'Viewer' | null;
  companies: Company[];
  members: GroupMember[];
  invitations: GroupInvitation[];
  loading: boolean;
  
  fetchTenantData: () => Promise<void>;
  setActiveGroup: (group: Group) => Promise<void>;
  createGroup: (nome: string) => Promise<Group | null>;
  createInvitation: (email: string, role: GroupInvitation['role']) => Promise<GroupInvitation | null>;
  cancelInvitation: (invitationId: string) => Promise<boolean>;
  changeMemberRole: (memberId: string, newRole: GroupMember['role']) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  createCompany: (nome: string, cnpj: string) => Promise<Company | null>;
  deleteCompany: (companyId: string) => Promise<boolean>;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  groups: [],
  activeGroup: null,
  activeRole: null,
  companies: [],
  members: [],
  invitations: [],
  loading: false,

  fetchTenantData: async () => {
    let user = useAuthStore.getState().user;
    if (!user && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user || null;
    }
    
    if (!user) {
      set({ groups: [], activeGroup: null, activeRole: null, companies: [], members: [], invitations: [] });
      return;
    }

    if (!supabase) {
      console.warn("Supabase não inicializado em fetchTenantData.");
      return;
    }

    set({ loading: true });
    try {
      // 1. Fetch user's active group memberships AND owned groups to build access list
      const [membershipsRes, ownedGroupsRes] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id, role")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("groups")
          .select("id, nome, owner_user_id")
          .eq("owner_user_id", user.id),
      ]);

      const roleMap = new Map<string, string>();
      
      if (membershipsRes.data) {
        for (const m of membershipsRes.data) {
          roleMap.set(m.group_id, m.role);
        }
      }
      
      if (ownedGroupsRes.data) {
        for (const g of ownedGroupsRes.data) {
          roleMap.set(g.id, "Owner");
        }
      }

      const allGroupIds = Array.from(roleMap.keys());
      if (allGroupIds.length === 0) {
        set({ groups: [], activeGroup: null, activeRole: null, companies: [], members: [], invitations: [], loading: false });
        return;
      }

      // Fetch group details for all accessible groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .in("id", allGroupIds);

      if (groupsError) throw groupsError;

      const groupsList = groupsData || [];
      set({ groups: groupsList });

      // 2. Select active group
      let selectedGroup: Group | null = null;
      const storedGroupId = typeof window !== "undefined" ? localStorage.getItem("active_group_id") : null;
      if (storedGroupId) {
        selectedGroup = groupsList.find(g => g.id === storedGroupId) || null;
      }
      if (!selectedGroup && groupsList.length > 0) {
        selectedGroup = groupsList.find(g => g.owner_user_id === user.id) || groupsList[0];
      }

      if (!selectedGroup) {
        set({ activeGroup: null, activeRole: null, companies: [], members: [], invitations: [], loading: false });
        return;
      }

      if (typeof window !== "undefined" && selectedGroup) {
        localStorage.setItem("active_group_id", selectedGroup.id);
      }
      set({ activeGroup: selectedGroup });

      // 3. Fetch active group's companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .eq("group_id", selectedGroup.id);

      if (companiesError) throw companiesError;
      set({ companies: companiesData || [] });

      // 4. Fetch active group's members
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", selectedGroup.id);

      if (membersError) throw membersError;
      const membersList = membersData || [];

      const dbRole = roleMap.get(selectedGroup.id) || null;
      let activeRole = toStoreRole(dbRole);
      if (selectedGroup.owner_user_id === user.id) {
        activeRole = "Owner";
      }

      // Fetch member profiles
      if (membersList.length > 0) {
        const userIds = membersList.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nome, email, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const mappedMembers = membersList.map(m => ({
          ...m,
          profiles: profilesMap.get(m.user_id) || {
            nome: "Usuário",
            email: "—"
          }
        }));

        set({ members: mappedMembers as GroupMember[], activeRole });
      } else {
        set({ members: [], activeRole });
      }

      // 5. Fetch active group's pending/all invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("group_invitations")
        .select("*")
        .eq("group_id", selectedGroup.id);

      if (invitationsError) throw invitationsError;
      set({ invitations: invitationsData || [] });

    } catch (err: any) {
      console.error("Erro ao carregar dados do tenant:", err);
      toast.error("Não foi possível carregar as informações do seu grupo.");
    } finally {
      set({ loading: false });
    }
  },

  setActiveGroup: async (group: Group) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    if (typeof window !== "undefined") {
      localStorage.setItem("active_group_id", group.id);
    }
    
    set({ activeGroup: group, loading: true });
    
    try {
      // Wipe tenant-specific local tables
      await Promise.all([
        db.notas.clear(),
        db.notasTomadas.clear(),
        db.customCategories.clear(),
        db.categoryOverrides.clear(),
        db.serviceClassifications.clear(),
        db.categoryRules.clear(),
        db.auditLogs.clear()
      ]);

      // Fetch new group tenant data first
      await get().fetchTenantData();

      // Trigger full sync for new group
      toast.info(`Trocando para o grupo "${group.nome}" e sincronizando dados...`);
      await SyncManager.syncAll(user.id, true);
      
    } catch (err: any) {
      console.error("Erro ao trocar de grupo:", err);
      toast.error("Erro ao carregar dados do novo grupo.");
    } finally {
      set({ loading: false });
    }
  },

  createGroup: async (nome: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return null;
    }

    try {
      // Insert new group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          nome,
          owner_user_id: user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add user as Owner member of the group
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          role: "Owner",
          status: "active",
          accepted_at: new Date().toISOString()
        });

      if (memberError) throw memberError;

      toast.success(`Grupo "${nome}" criado com sucesso!`);
      
      // Reload tenant data
      await get().fetchTenantData();
      return groupData;
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar grupo.");
      return null;
    }
  },

  createInvitation: async (email: string, role: GroupInvitation['role']) => {
    const { activeGroup } = get();
    const user = useAuthStore.getState().user;
    if (!activeGroup || !user) return null;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return null;
    }

    try {
      // Generate a secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const dbRole = toDbRole(role);
      const { data, error } = await supabase
        .from("group_invitations")
        .insert({
          group_id: activeGroup.id,
          email,
          role: dbRole,
          token,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Convite criado com sucesso!");
      
      // Refresh invitations list
      const { data: invitationsData } = await supabase
        .from("group_invitations")
        .select("*")
        .eq("group_id", activeGroup.id);
      
      set({ invitations: invitationsData || [] });
      
      return data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar convite.");
      return null;
    }
  },

  cancelInvitation: async (invitationId: string) => {
    const { activeGroup } = get();
    if (!activeGroup) return false;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("group_invitations")
        .update({ status: "revoked" })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Convite cancelado.");

      // Refresh invitations list
      const { data: invitationsData } = await supabase
        .from("group_invitations")
        .select("*")
        .eq("group_id", activeGroup.id);
      
      set({ invitations: invitationsData || [] });
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar convite.");
      return false;
    }
  },

  changeMemberRole: async (memberId: string, newRole: GroupMember['role']) => {
    const { activeGroup } = get();
    if (!activeGroup) return false;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return false;
    }

    try {
      const dbRole = toDbRole(newRole);
      const { error } = await supabase
        .from("group_members")
        .update({ role: dbRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Função do membro atualizada com sucesso!");
      
      // Refresh tenant data
      await get().fetchTenantData();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar função do membro.");
      return false;
    }
  },

  removeMember: async (memberId: string) => {
    const { activeGroup } = get();
    if (!activeGroup) return false;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Membro removido do grupo.");
      
      // Refresh tenant data
      await get().fetchTenantData();
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover membro.");
      return false;
    }
  },

  createCompany: async (nome: string, cnpj: string) => {
    const { activeGroup } = get();
    if (!activeGroup) return null;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          group_id: activeGroup.id,
          nome,
          cnpj
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Empresa "${nome}" adicionada com sucesso!`);
      
      // Refresh companies list
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .eq("group_id", activeGroup.id);
      
      set({ companies: companiesData || [] });
      return data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar empresa.");
      return null;
    }
  },

  deleteCompany: async (companyId: string) => {
    const { activeGroup } = get();
    if (!activeGroup) return false;
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return false;
    }

    try {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;

      toast.success("Empresa removida com sucesso.");

      // Refresh companies list
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .eq("group_id", activeGroup.id);
      
      set({ companies: companiesData || [] });
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover empresa.");
      return false;
    }
  }
}));
