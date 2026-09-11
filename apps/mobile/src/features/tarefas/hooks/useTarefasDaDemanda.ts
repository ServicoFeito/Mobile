import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Tarefa } from "@/features/tarefas/types/tarefa.types";

export function useTarefasDaDemanda(demandaId: string) {
  return useQuery<Tarefa[]>({
    queryKey: ["tarefas", "demanda", demandaId],
    enabled: !!demandaId,
    queryFn: () => repositories.tarefas.listarDaDemanda(demandaId),
  });
}
