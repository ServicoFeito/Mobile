import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Tarefa } from "@/features/tarefas/types/tarefa.types";
import type { TarefasRepository } from "./tarefasRepository";
import { normalizarErro } from "../types";

type LinhaTarefa = Database["public"]["Tables"]["tarefas_demanda"]["Row"];

const SELECT_TAREFA = "id, demanda_id, nome_tarefa, descricao, concluida, created_at";

function paraTarefa(l: LinhaTarefa): Tarefa {
  return {
    id: l.id,
    demandaId: l.demanda_id,
    nomeTarefa: l.nome_tarefa,
    descricao: l.descricao,
    concluida: l.concluida,
    createdAt: l.created_at,
  };
}

export const tarefasRepositorySupabase: TarefasRepository = {
  async listarDaDemanda(demandaId) {
    try {
      const { data, error } = await supabase
        .from("tarefas_demanda")
        .select(SELECT_TAREFA)
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: true });
      if (error) throw normalizarErro(error);
      const linhas = (data ?? []) as unknown as LinhaTarefa[];
      return linhas.map(paraTarefa);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async marcarConcluida(tarefaId, concluida) {
    try {
      const { error } = await supabase.from("tarefas_demanda").update({ concluida }).eq("id", tarefaId);
      if (error) throw normalizarErro(error);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
