import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Conversa } from "@/features/conversas/types/conversa.types";
import type { ConversasRepository } from "./conversasRepository";
import { normalizarErro } from "../types";

type LinhaConversa = Database["public"]["Tables"]["conversas"]["Row"];

const SELECT_CONVERSA =
  "id, tipo, demanda_id, cliente_id, prestador_id, status, ultima_mensagem, data_ultima_mensagem, nao_lidas_cliente, nao_lidas_prestador, created_at";

interface Outro {
  nome: string | null;
  foto_perfil_url: string | null;
}

function paraConversa(l: LinhaConversa, usuarioId: string, outro: Outro | null): Conversa {
  const ehCliente = usuarioId === l.cliente_id;
  return {
    id: l.id,
    tipo: l.tipo,
    demandaId: l.demanda_id,
    clienteId: l.cliente_id,
    prestadorId: l.prestador_id,
    status: l.status,
    ultimaMensagem: l.ultima_mensagem,
    dataUltimaMensagem: l.data_ultima_mensagem,
    naoLidas: ehCliente ? l.nao_lidas_cliente : l.nao_lidas_prestador,
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

export const conversasRepositorySupabase: ConversasRepository = {
  async listarMinhas(usuarioId: string): Promise<Conversa[]> {
    try {
      const { data, error } = await supabase
        .from("conversas")
        .select(SELECT_CONVERSA)
        .or(`cliente_id.eq.${usuarioId},prestador_id.eq.${usuarioId}`)
        .order("data_ultima_mensagem", { ascending: false, nullsFirst: false });
      if (error) throw normalizarErro(error);

      const linhas = (data ?? []) as unknown as LinhaConversa[];
      const outrosIds = linhas.map((l) => (l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id));
      const mapaOutros = await carregarOutros(outrosIds);

      return linhas.map((l) => {
        const outroId = l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id;
        return paraConversa(l, usuarioId, mapaOutros.get(outroId) ?? null);
      });
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obter(id: string, usuarioId: string): Promise<Conversa> {
    try {
      const { data, error } = await supabase
        .from("conversas")
        .select(SELECT_CONVERSA)
        .eq("id", id)
        .single();
      if (error) throw normalizarErro(error);

      const l = data as unknown as LinhaConversa;
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

      return paraConversa(l, usuarioId, outro);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async iniciarDireta(clienteId: string, prestadorId: string): Promise<{ id: string }> {
    try {
      const achar = () =>
        supabase
          .from("conversas")
          .select("id")
          .eq("tipo", "DIRETA")
          .eq("cliente_id", clienteId)
          .eq("prestador_id", prestadorId)
          .maybeSingle();

      const { data: existente } = await achar();
      if (existente) return { id: (existente as { id: string }).id };

      const row: Database["public"]["Tables"]["conversas"]["Insert"] = {
        tipo: "DIRETA",
        cliente_id: clienteId,
        prestador_id: prestadorId,
        demanda_id: null,
      };
      const { data, error } = await supabase
        .from("conversas")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        const err = normalizarErro(error);
        if (err.code === "conflito") {
          // corrida: alguém criou entre o achar() e o insert
          const { data: dep } = await achar();
          if (dep) return { id: (dep as { id: string }).id };
        }
        throw err;
      }
      return { id: (data as { id: string }).id };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async iniciarDemanda(demandaId: string, prestadorId: string): Promise<{ id: string }> {
    try {
      const { data: dem, error: e1 } = await supabase
        .from("demandas_servico")
        .select("cliente_id")
        .eq("id", demandaId)
        .single();
      if (e1) throw normalizarErro(e1);
      const clienteId = (dem as { cliente_id: string }).cliente_id;

      const achar = () =>
        supabase
          .from("conversas")
          .select("id")
          .eq("tipo", "DEMANDA")
          .eq("demanda_id", demandaId)
          .eq("prestador_id", prestadorId)
          .maybeSingle();

      const { data: existente } = await achar();
      if (existente) return { id: (existente as { id: string }).id };

      const row: Database["public"]["Tables"]["conversas"]["Insert"] = {
        tipo: "DEMANDA",
        demanda_id: demandaId,
        cliente_id: clienteId,
        prestador_id: prestadorId,
      };
      const { data, error } = await supabase
        .from("conversas")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        const err = normalizarErro(error);
        if (err.code === "conflito") {
          const { data: dep } = await achar();
          if (dep) return { id: (dep as { id: string }).id };
        }
        throw err;
      }
      return { id: (data as { id: string }).id };
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
