import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";

interface AuthState {
  session: Session | null;
  usuarioId: string | null;
  carregando: boolean;
  hidratar: () => Promise<void>;
  definirSessao: (session: Session | null) => void;
  sair: () => Promise<void>;
  iniciarListenerAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  usuarioId: null,
  carregando: true,

  hidratar: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session ?? null,
      usuarioId: data.session?.user?.id ?? null,
      carregando: false,
    });
  },

  definirSessao: (session) =>
    set({ session, usuarioId: session?.user?.id ?? null }),

  sair: async () => {
    await supabase.auth.signOut();
    set({ session: null, usuarioId: null });
  },

  iniciarListenerAuth: () => {
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      set({ session, usuarioId: session?.user?.id ?? null });
    });
    return () => data.subscription.unsubscribe();
  },
}));
