import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { NovaDemanda } from "@/features/demandas/types/demanda.types";

export type DadosNovaDemanda = Omit<NovaDemanda, "clienteId">;

export function useCriarDemanda() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<{ id: string }, unknown, DadosNovaDemanda>({
    mutationFn: (dados) => repositories.demandas.criar({ ...dados, clienteId: usuarioId ?? "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandas", "abertas"] });
    },
  });
}
