import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";

export function useMarcarTarefaConcluida(demandaId: string) {
  return useMutation<void, unknown, { tarefaId: string; concluida: boolean }>({
    mutationFn: (v) => repositories.tarefas.marcarConcluida(v.tarefaId, v.concluida),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas", "demanda", demandaId] }),
  });
}
