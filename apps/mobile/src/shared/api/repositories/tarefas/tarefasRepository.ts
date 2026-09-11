import type { Tarefa } from "@/features/tarefas/types/tarefa.types";

export interface TarefasRepository {
  /** Tarefas da demanda, mais antigas primeiro. */
  listarDaDemanda(demandaId: string): Promise<Tarefa[]>;
  /** RLS: só o cliente dono da demanda pode marcar/desmarcar (senão `nao_autorizado`). */
  marcarConcluida(tarefaId: string, concluida: boolean): Promise<void>;
}
