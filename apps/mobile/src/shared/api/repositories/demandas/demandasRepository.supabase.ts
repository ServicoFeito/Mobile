import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type {
  DemandaResumo,
  DemandaDetalhe,
  NovaDemanda,
  FiltrosDemanda,
} from "@/features/demandas/types/demanda.types";
import type { PageParams } from "../types";
import type { DemandasRepository } from "./demandasRepository";
import { normalizarErro } from "../types";

type LinhaDemanda = Database["public"]["Tables"]["demandas_servico"]["Row"] & {
  categoria_servico: { nome: string } | null;
  perfis_publicos: { nome: string | null } | null;
};

const SELECT_RESUMO =
  "id, titulo, descricao, categoria_id, endereco_cidade, endereco_bairro, orcamento_maximo, urgencia, status, total_propostas, created_at, categoria_servico(nome)";

const SELECT_DETALHE =
  SELECT_RESUMO +
  ", endereco_completo, data_desejada, perfis_publicos:demandas_servico_cliente_id_fkey(nome)";

function paraResumo(l: LinhaDemanda): DemandaResumo {
  return {
    id: l.id,
    titulo: l.titulo,
    descricao: l.descricao,
    categoriaId: l.categoria_id,
    categoriaNome: l.categoria_servico?.nome ?? "",
    enderecoCidade: l.endereco_cidade,
    enderecoBairro: l.endereco_bairro,
    orcamentoMaximo: l.orcamento_maximo,
    urgencia: l.urgencia,
    status: l.status,
    totalPropostas: l.total_propostas,
    createdAt: l.created_at,
  };
}

export const demandasRepositorySupabase: DemandasRepository = {
  async listarAbertas(filtros: FiltrosDemanda, page: PageParams) {
    try {
      let q = supabase
        .from("demandas_servico")
        .select(SELECT_RESUMO)
        .eq("status", "ABERTA")
        .order("created_at", { ascending: false });

      if (filtros.categoriaId) q = q.eq("categoria_id", filtros.categoriaId);
      if (filtros.cidade) q = q.eq("endereco_cidade", filtros.cidade);
      if (filtros.termo) q = q.ilike("titulo", `%${filtros.termo}%`);
      if (page.cursor) q = q.lt("created_at", page.cursor);

      const { data, error } = await q.limit(page.limite + 1);
      if (error) throw normalizarErro(error);

      const linhas = (data ?? []) as unknown as LinhaDemanda[];
      const temMais = linhas.length > page.limite;
      const itens = linhas.slice(0, page.limite).map(paraResumo);
      const proximoCursor = temMais ? (itens[itens.length - 1]?.createdAt ?? null) : null;
      return { itens, proximoCursor };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obter(id: string): Promise<DemandaDetalhe> {
    try {
      const { data, error } = await supabase
        .from("demandas_servico")
        .select(SELECT_DETALHE)
        .eq("id", id)
        .single();
      if (error) throw normalizarErro(error);
      const l = data as unknown as LinhaDemanda;
      return {
        ...paraResumo(l),
        enderecoCompleto: l.endereco_completo,
        dataDesejada: l.data_desejada,
        clienteNome: l.perfis_publicos?.nome ?? null,
      };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async criar(dados: NovaDemanda) {
    try {
      const row: Database["public"]["Tables"]["demandas_servico"]["Insert"] = {
        cliente_id: dados.clienteId,
        categoria_id: dados.categoriaId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        orcamento_maximo: dados.orcamentoMaximo,
        urgencia: dados.urgencia,
        endereco_cidade: dados.enderecoCidade,
        endereco_bairro: dados.enderecoBairro,
        endereco_completo: dados.enderecoCompleto,
        data_desejada: dados.dataDesejada,
      };
      const { data, error } = await supabase
        .from("demandas_servico")
        .insert(row)
        .select("id")
        .single();
      if (error) throw normalizarErro(error);
      return { id: (data as { id: string }).id };
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
