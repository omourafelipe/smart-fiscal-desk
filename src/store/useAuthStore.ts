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
        set({ session: null, user: null, profile: null, loading: false });
      }
    });
  }

  return {
    user: null,
    session: null,
    profile: null,
    loading: isSupabaseConfigured, // Só fica em loading no início se o Supabase estiver configurado
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
          // O listener de AuthStateChange vai pegar a sessão e carregar o perfil
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
      if (!isSupabaseConfigured || !supabase) {
        set({ session: null, user: null, profile: null });
        toast.info("Desconectado do modo local.");
        return;
      }

      set({ loading: true });
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        set({ session: null, user: null, profile: null, loading: false });
        toast.success("Você saiu da sua conta.");
      } catch (err: any) {
        toast.error(err.message || "Erro ao deslogar.");
        set({ loading: false });
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
