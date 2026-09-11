import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useConcluirExecucao(propostaId: string) {
  return useMutation<string, unknown, string>({
    mutationFn: (contratacaoId) => repositories.contratacoes.concluirExecucao(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
      queryClient.invalidateQueries({ queryKey: ["pagamento", "pendente"] });
    },
  });
}
