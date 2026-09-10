import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { NovaProposta } from "@/features/propostas/types/proposta.types";

export type DadosNovaProposta = Omit<NovaProposta, "prestadorId">;

export function useCriarProposta() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<{ id: string }, unknown, DadosNovaProposta>({
    mutationFn: (d) => repositories.propostas.criar({ ...d, prestadorId: usuarioId ?? "" }),
    onSuccess: (_r, d) =>
      queryClient.invalidateQueries({ queryKey: ["propostas", "conversa", d.conversaId] }),
  });
}
