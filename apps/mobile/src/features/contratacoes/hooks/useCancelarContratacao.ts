import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useCancelarContratacao(propostaId: string, demandaId: string | null) {
  return useMutation<void, unknown, string>({
    mutationFn: (contratacaoId) => repositories.contratacoes.cancelar(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
      if (demandaId) {
        queryClient.invalidateQueries({ queryKey: ["demandas", "detalhe", demandaId] });
        queryClient.invalidateQueries({ queryKey: ["demandas", "abertas"] });
      }
    },
  });
}
