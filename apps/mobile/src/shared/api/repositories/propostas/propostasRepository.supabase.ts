import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { NovaProposta, Proposta } from "@/features/propostas/types/proposta.types";
import type { PropostasRepository } from "./propostasRepository";
import { normalizarErro } from "../types";

type LinhaProposta = Database["public"]["Tables"]["propostas"]["Row"];

const SELECT_PROP =
  "id, demanda_id, conversa_id, prestador_id, cliente_id, valor, taxa_plataforma, valor_liquido_prestador, descricao, prazo_execucao, validade_dias, status, created_at";

/** `numeric` do Postgres pode chegar como `string` no supabase-js. */
function num(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

function numOuNull(v: number | string | null): number | null {
  return v === null ? null : num(v);
}

function paraProposta(l: LinhaProposta): Proposta {
  return {
    id: l.id,
    demandaId: l.demanda_id,
    conversaId: l.conversa_id,
    prestadorId: l.prestador_id,
    clienteId: l.cliente_id,
    valor: num(l.valor),
    taxaPlataforma: numOuNull(l.taxa_plataforma),
    valorLiquidoPrestador: numOuNull(l.valor_liquido_prestador),
    descricao: l.descricao,
    prazoExecucao: l.prazo_execucao,
    validadeDias: l.validade_dias,
    status: l.status,
    createdAt: l.created_at,
  };
}

export const propostasRepositorySupabase: PropostasRepository = {
  async daConversa(conversaId: string): Promise<Proposta[]> {
    try {
      const { data, error } = await supabase
        .from("propostas")
        .select(SELECT_PROP)
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: true });
      if (error) throw normalizarErro(error);
      return ((data ?? []) as unknown as LinhaProposta[]).map(paraProposta);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obter(id: string): Promise<Proposta> {
    try {
      const { data, error } = await supabase
        .from("propostas")
        .select(SELECT_PROP)
        .eq("id", id)
        .single();
      if (error) throw normalizarErro(error);
      return paraProposta(data as unknown as LinhaProposta);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async criar(dados: NovaProposta): Promise<{ id: string }> {
    try {
      const row = {
        conversa_id: dados.conversaId,
        demanda_id: dados.demandaId,
        prestador_id: dados.prestadorId,
        cliente_id: dados.clienteId,
        valor: dados.valor,
        descricao: dados.descricao,
        prazo_execucao: dados.prazoExecucao,
        validade_dias: dados.validadeDias,
      };
      const { data, error } = await supabase
        .from("propostas")
        .insert(row)
        .select("id")
        .single();
      if (error) throw normalizarErro(error);
      return { id: (data as { id: string }).id };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async recusar(propostaId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc("fn_recusar_proposta", {
        p_proposta_id: propostaId,
      });
      if (error) throw normalizarErro(error);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async aceitar(propostaId: string): Promise<{ contratacaoId: string }> {
    try {
      const { data, error } = await supabase.rpc("fn_aceitar_proposta", {
        p_proposta_id: propostaId,
      });
      if (error) throw normalizarErro(error);
      return { contratacaoId: data as string };
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
