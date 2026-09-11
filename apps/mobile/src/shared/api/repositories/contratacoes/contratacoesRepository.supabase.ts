import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";
import type { ContratacoesRepository } from "./contratacoesRepository";
import { normalizarErro } from "../types";

type LinhaContratacao = Database["public"]["Tables"]["contratacoes"]["Row"];

const SELECT_CONTRATACAO =
  "id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, valor_entrada, valor_final, taxa_plataforma, status, entrada_paga, final_pago, avaliado, data_agendada, data_conclusao, created_at";

interface Outro {
  nome: string | null;
  foto_perfil_url: string | null;
}

function num(v: number | string | null): number | null {
  if (v === null) return null;
  return typeof v === "string" ? Number(v) : v;
}

function paraContratacao(l: LinhaContratacao, usuarioId: string, outro: Outro | null): Contratacao {
  const ehCliente = usuarioId === l.cliente_id;
  return {
    id: l.id,
    demandaId: l.demanda_id,
    propostaId: l.proposta_id,
    tituloServico: l.titulo_servico,
    clienteId: l.cliente_id,
    prestadorId: l.prestador_id,
    valorTotal: num(l.valor_total) ?? 0,
    valorEntrada: num(l.valor_entrada),
    valorFinal: num(l.valor_final),
    taxaPlataforma: num(l.taxa_plataforma),
    status: l.status,
    entradaPaga: l.entrada_paga,
    finalPago: l.final_pago,
    avaliado: l.avaliado,
    dataAgendada: l.data_agendada,
    dataConclusao: l.data_conclusao,
    outroId: ehCliente ? l.prestador_id : l.cliente_id,
    outroNome: outro?.nome ?? null,
    outroFotoUrl: outro?.foto_perfil_url ?? null,
    createdAt: l.created_at,
  };
}

/**
 * Nomes/fotos dos "outros" via view pública. Falha aqui **não** propaga:
 * devolve um Map vazio e os nomes caem para `null`.
 */
async function carregarOutros(ids: string[]): Promise<Map<string, Outro>> {
  const mapa = new Map<string, Outro>();
  if (ids.length === 0) return mapa;
  try {
    const { data, error } = await supabase
      .from("perfis_publicos")
      .select("usuario_id, nome, foto_perfil_url")
      .in("usuario_id", [...new Set(ids)]);
    if (error || !data) return mapa;
    for (const p of data as { usuario_id: string | null; nome: string | null; foto_perfil_url: string | null }[]) {
      if (p.usuario_id) {
        mapa.set(p.usuario_id, { nome: p.nome ?? null, foto_perfil_url: p.foto_perfil_url ?? null });
      }
    }
  } catch {
    return mapa;
  }
  return mapa;
}

export const contratacoesRepositorySupabase: ContratacoesRepository = {
  async obterPorProposta(propostaId: string, usuarioId: string): Promise<Contratacao> {
    try {
      const { data, error } = await supabase
        .from("contratacoes")
        .select(SELECT_CONTRATACAO)
        .eq("proposta_id", propostaId)
        .single();
      if (error) throw normalizarErro(error);

      const l = data as unknown as LinhaContratacao;
      const outroId = l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id;

      // "Outro" vem da view pública. Falha aqui não derruba o detalhe.
      const { data: perfil } = await supabase
        .from("perfis_publicos")
        .select("usuario_id, nome, foto_perfil_url")
        .eq("usuario_id", outroId)
        .maybeSingle();
      const p = perfil as { nome: string | null; foto_perfil_url: string | null } | null;
      const outro: Outro | null = p
        ? { nome: p.nome ?? null, foto_perfil_url: p.foto_perfil_url ?? null }
        : null;

      return paraContratacao(l, usuarioId, outro);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async listarMinhas(usuarioId: string): Promise<Contratacao[]> {
    try {
      const { data, error } = await supabase
        .from("contratacoes")
        .select(SELECT_CONTRATACAO)
        .or(`cliente_id.eq.${usuarioId},prestador_id.eq.${usuarioId}`)
        .order("created_at", { ascending: false });
      if (error) throw normalizarErro(error);

      const linhas = (data ?? []) as unknown as LinhaContratacao[];
      const outrosIds = linhas.map((l) => (l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id));
      const mapaOutros = await carregarOutros(outrosIds);

      return linhas.map((l) => {
        const outroId = l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id;
        return paraContratacao(l, usuarioId, mapaOutros.get(outroId) ?? null);
      });
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async cancelar(contratacaoId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc("fn_cancelar_contratacao", {
        p_contratacao_id: contratacaoId,
      });
      if (error) throw normalizarErro(error);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
