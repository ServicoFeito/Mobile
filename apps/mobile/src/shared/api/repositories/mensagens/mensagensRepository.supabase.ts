import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Mensagem } from "@/features/conversas/types/conversa.types";
import type { PageParams, Pagina } from "../types";
import type { MensagensRepository } from "./mensagensRepository";
import { normalizarErro } from "../types";

type LinhaMsg = Database["public"]["Tables"]["mensagens"]["Row"];

const SELECT_MSG =
  "id, conversa_id, remetente_id, tipo, corpo, proposta_id, lida, created_at";

function paraMensagem(l: LinhaMsg): Mensagem {
  return {
    id: l.id,
    conversaId: l.conversa_id,
    remetenteId: l.remetente_id,
    tipo: l.tipo,
    corpo: l.corpo,
    propostaId: l.proposta_id,
    lida: l.lida,
    createdAt: l.created_at,
  };
}

export const mensagensRepositorySupabase: MensagensRepository = {
  async listar(conversaId: string, page: PageParams): Promise<Pagina<Mensagem>> {
    try {
      let q = supabase
        .from("mensagens")
        .select(SELECT_MSG)
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: false });
      if (page.cursor) q = q.lt("created_at", page.cursor);

      const { data, error } = await q.limit(page.limite + 1);
      if (error) throw normalizarErro(error);

      const linhas = (data ?? []) as unknown as LinhaMsg[];
      const temMais = linhas.length > page.limite;
      const itens = linhas.slice(0, page.limite).map(paraMensagem);
      const proximoCursor = temMais ? (itens[itens.length - 1]?.createdAt ?? null) : null;
      return { itens, proximoCursor };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async enviarTexto(
    conversaId: string,
    corpo: string,
    remetenteId: string,
  ): Promise<Mensagem> {
    try {
      const { data, error } = await supabase
        .from("mensagens")
        .insert({ conversa_id: conversaId, remetente_id: remetenteId, tipo: "TEXTO", corpo })
        .select(SELECT_MSG)
        .single();
      if (error) throw normalizarErro(error);
      return paraMensagem(data as unknown as LinhaMsg);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async marcarLidas(
    conversaId: string,
    usuarioId: string,
    papel: "CLIENTE" | "PRESTADOR",
  ): Promise<void> {
    try {
      const { error: e1 } = await supabase
        .from("mensagens")
        .update({ lida: true })
        .eq("conversa_id", conversaId)
        .eq("lida", false)
        .neq("remetente_id", usuarioId);
      if (e1) throw normalizarErro(e1);

      const zerarContador =
        papel === "CLIENTE" ? { nao_lidas_cliente: 0 } : { nao_lidas_prestador: 0 };
      const { error: e2 } = await supabase
        .from("conversas")
        .update(zerarContador)
        .eq("id", conversaId);
      if (e2) throw normalizarErro(e2);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
