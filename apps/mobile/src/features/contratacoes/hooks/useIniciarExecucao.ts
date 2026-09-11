import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useIniciarExecucao(propostaId: string) {
  return useMutation<void, unknown, string>({
    mutationFn: (contratacaoId) => repositories.contratacoes.iniciarExecucao(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
    },
  });
}
