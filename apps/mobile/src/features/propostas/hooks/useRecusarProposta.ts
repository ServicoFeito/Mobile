import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useRecusarProposta(conversaId: string) {
  return useMutation<void, unknown, string>({
    mutationFn: (propostaId) => repositories.propostas.recusar(propostaId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["propostas", "conversa", conversaId] }),
  });
}
