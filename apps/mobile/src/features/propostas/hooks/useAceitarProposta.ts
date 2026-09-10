import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useAceitarProposta(conversaId: string, demandaId: string | null) {
  return useMutation<{ contratacaoId: string }, unknown, string>({
    mutationFn: (propostaId) => repositories.propostas.aceitar(propostaId),
    onSuccess: () => {
      const chaves: string[][] = [
        ["propostas", "conversa", conversaId],
        ["mensagens", conversaId],
        ["conversa", conversaId],
        ["conversas", "minhas"],
        ["demandas", "abertas"],
      ];
      for (const queryKey of chaves) queryClient.invalidateQueries({ queryKey });
      if (demandaId) queryClient.invalidateQueries({ queryKey: ["demandas", "detalhe", demandaId] });
    },
  });
}
