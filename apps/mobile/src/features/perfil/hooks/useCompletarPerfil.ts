import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { useAuthStore } from "@/shared/store/authStore";
import { queryClient } from "@/shared/query/queryClient";

export interface DadosPerfil {
  nome: string;
  telefone: string;
  cidade: string;
}

export function useCompletarPerfil() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation({
    mutationFn: async ({ nome, telefone, cidade }: DadosPerfil) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ nome, telefone, cidade })
        .eq("id", usuarioId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil", "atual"] });
    },
  });
}
