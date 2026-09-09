import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { PerfilAtual } from "../types/perfil.types";

export function usePerfilAtual() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<PerfilAtual | null>({
    queryKey: ["perfil", "atual", usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, telefone, cidade")
        .eq("id", usuarioId!)
        .single();
      if (error) throw new Error(error.message);
      return data as PerfilAtual;
    },
  });
}
