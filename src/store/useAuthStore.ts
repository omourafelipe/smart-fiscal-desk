import { create } from "zustand";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Profile {
  id: string;
  nome: string;
  empresa: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  initialized: boolean;
  signUp: (email: string, password: string, nome: string, empresa: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  updateProfile: (nome: string, empresa: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Configura o listener do Supabase se ele estiver configurado
  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        if (!supabase) return;
        set({ session, user: session.user, loading: true });
        // Busca perfil
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (!error && data) {
            set({ profile: data, loading: false });
          } else {
            // Se falhou ao buscar perfil (ex: trigger ainda não rodou)
            // Cria um perfil provisório baseado no metadata
            const metadata = session.user.user_metadata;
            const tempProfile = {
              id: session.user.id,
              nome: metadata?.nome || "Usuário",
              empresa: metadata?.empresa || "Empresa"
            };
            set({ profile: tempProfile, loading: false });
          }
        } catch {
          set({ loading: false });
        }
      } else {
        // Se a sessão foi encerrada (ex: signOut em outra aba)
        // Só rodamos a limpeza se tínhamos um usuário ativo antes para evitar loop na inicialização
        const currentUser = get().user;
        if (currentUser) {
          set({ user: null, session: null, profile: null });
          await get().signOut();
        } else {
          set({ session: null, user: null, profile: null, loading: false });
        }
      }
    });
  }

  return {
    user: null,
    session: null,
    profile: null,
    loading: false, // Inicia como false para permitir edição imediata dos campos
    isSupabaseConfigured,
    initialized: false,

    checkSession: async () => {
      if (get().initialized) return;

      if (!isSupabaseConfigured || !supabase) {
        set({ loading: false, initialized: true });
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          set({ session, user: session.user, profile, loading: false, initialized: true });
        } else {
          set({ session: null, user: null, profile: null, loading: false, initialized: true });
        }
      } catch (err) {
        console.error("Erro ao checar sessão inicial:", err);
        set({ loading: false, initialized: true });
      }
    },

    signUp: async (email, password, nome, empresa) => {
      if (!isSupabaseConfigured || !supabase) {
        toast.error("O Supabase não está configurado para autenticação na nuvem.");
        return false;
      }

      set({ loading: true });
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome,
              empresa
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          toast.success("Conta criada com sucesso! Você já pode fazer login.");
          set({ loading: false });
          return true;
        }

        set({ loading: false });
        return false;
      } catch (err: any) {
        toast.error(err.message || "Erro ao criar conta.");
        set({ loading: false });
        return false;
      }
    },

    signIn: async (email, password) => {
      if (!isSupabaseConfigured || !supabase) {
        toast.error("O Supabase não está configurado para autenticação na nuvem.");
        return false;
      }

      set({ loading: true });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Login efetuado com sucesso!");
          
          let profileData = null;
          try {
            const { data: prof, error: profErr } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", data.session.user.id)
              .single();
            if (!profErr && prof) {
              profileData = prof;
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error("Erro ao buscar perfil:", e);
            }
          }

          if (!profileData) {
            const metadata = data.session.user.user_metadata;
            profileData = {
              id: data.session.user.id,
              nome: metadata?.nome || "Usuário",
              empresa: metadata?.empresa || "Empresa"
            };
          }

          set({
            session: data.session,
            user: data.session.user,
            profile: profileData,
            loading: false,
            initialized: true
          });
          return true;
        }

        set({ loading: false });
        return false;
      } catch (err: any) {
        toast.error(err.message || "Erro ao efetuar login.");
        set({ loading: false });
        return false;
      }
    },

    signOut: async () => {
      // Limpar user, session e profile no store antes de chamar o signOut do Supabase para evitar o loop
      set({ user: null, session: null, profile: null, loading: true });
      try {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        }
      } catch (err: any) {
        console.error("Erro ao deslogar do Supabase:", err);
      } finally {
        // 1. Limpar caches de queries em memória (TanStack Query)
        try {
          const { queryClient } = await import("@/router");
          queryClient.clear();
        } catch (queryErr) {
          console.error("Erro ao limpar TanStack Query cache:", queryErr);
        }

        // 2. Resetar estado do Global Filters
        try {
          const { useGlobalFilters } = await import("./useGlobalFilters");
          useGlobalFilters.getState().resetFilters();
        } catch (filterErr) {
          console.error("Erro ao resetar global filters:", filterErr);
        }

        // 3. Limpar tabelas do IndexedDB (Dexie)
        try {
          const { db } = await import("@/lib/db");
          await Promise.all([
            db.notas.clear(),
            db.notasTomadas.clear(),
            db.customCategories.clear(),
            db.categoryOverrides.clear(),
            db.serviceClassifications.clear(),
            db.categoryRules.clear(),
            db.auditLogs.clear()
          ]);
        } catch (dbErr) {
          console.error("Erro ao limpar IndexedDB no logout:", dbErr);
        }

        // 4. Limpar estado do Tenant Store
        try {
          const { useTenantStore } = await import("./useTenantStore");
          useTenantStore.setState({
            groups: [],
            activeGroup: null,
            activeRole: null,
            companies: [],
            members: [],
            invitations: [],
            loading: false
          });
        } catch (tenantErr) {
          console.error("Erro ao limpar tenant store no logout:", tenantErr);
        }

        // 5. Limpar localStorage (active_group_id e chaves do Supabase sb-*)
        if (typeof window !== "undefined") {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key === "active_group_id" || key.startsWith("sb-"))) {
              localStorage.removeItem(key);
            }
          }
        }

        // 6. Resetar estado local do Auth Store
        set({ session: null, user: null, profile: null, loading: false, initialized: false });
        
        toast.success("Você saiu da sua conta.");

        // 7. Redirecionar forçado substituindo o histórico
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }
      }
    },

    updateProfile: async (nome, empresa) => {
      if (!isSupabaseConfigured || !supabase || !get().user) return false;

      try {
        const { error } = await supabase
          .from("profiles")
          .update({ nome, empresa, updated_at: new Date().toISOString() })
          .eq("id", get().user!.id);

        if (error) throw error;

        set({ profile: { id: get().user!.id, nome, empresa } });
        toast.success("Perfil atualizado!");
        return true;
      } catch (err: any) {
        toast.error(err.message || "Erro ao atualizar perfil.");
        return false;
      }
    }
  };
});
