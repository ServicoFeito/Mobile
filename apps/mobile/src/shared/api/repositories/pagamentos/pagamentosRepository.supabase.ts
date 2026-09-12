import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";
import type { PagamentosRepository } from "./pagamentosRepository";
import { normalizarErro, repoErrorDeCodigo } from "../types";

type LinhaPagamento = Database["public"]["Tables"]["pagamentos"]["Row"];

const SELECT_PAGAMENTO =
  "id, contratacao_id, valor, tipo, status, txid, efi_loc_id, pix_copia_cola, qr_code_base64, data_pagamento, created_at";

function num(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

function paraPagamento(l: LinhaPagamento): Pagamento {
  return {
    id: l.id,
    contratacaoId: l.contratacao_id,
    valor: num(l.valor),
    tipo: l.tipo,
    status: l.status,
    txid: l.txid,
    efiLocId: l.efi_loc_id,
    pixCopiaCola: l.pix_copia_cola,
    qrCodeBase64: l.qr_code_base64,
    dataPagamento: l.data_pagamento,
    createdAt: l.created_at,
  };
}

/**
 * `supabase.functions.invoke` erra com um `FunctionsHttpError` (`{ name, message,
 * context: Response }`) — nao tem `.code`. O corpo real (`{ error: { code } }`,
 * ja no formato final que as Edge Functions deste projeto mandam) esta em
 * `error.context`, uma Response que precisa ser lida com `.json()`.
 */
async function erroDaEdgeFunction(error: unknown): Promise<import("../types").RepoError> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { error?: { code?: unknown } };
      return repoErrorDeCodigo(body?.error?.code);
    } catch {
      // corpo nao-JSON (ex.: falha de rede antes da function responder) -- cai no generico abaixo
    }
  }
  return normalizarErro(error);
}

export const pagamentosRepositorySupabase: PagamentosRepository = {
  async buscarPendente(contratacaoId: string): Promise<Pagamento | null> {
    try {
      const { data, error } = await supabase
        .from("pagamentos")
        .select(SELECT_PAGAMENTO)
        .eq("contratacao_id", contratacaoId)
        .in("status", ["PENDENTE", "PROCESSANDO"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw normalizarErro(error);
      if (!data) return null;

      return paraPagamento(data as unknown as LinhaPagamento);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async criarCobranca(pagamentoId: string): Promise<Pagamento> {
    try {
      const { error } = await supabase.functions.invoke("criar-cobranca-pix", {
        body: { pagamento_id: pagamentoId },
      });
      if (error) throw await erroDaEdgeFunction(error);

      return await pagamentosRepositorySupabase.obterPorId(pagamentoId);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obterPorId(pagamentoId: string): Promise<Pagamento> {
    try {
      const { data, error } = await supabase
        .from("pagamentos")
        .select(SELECT_PAGAMENTO)
        .eq("id", pagamentoId)
        .single();
      if (error) throw normalizarErro(error);

      return paraPagamento(data as unknown as LinhaPagamento);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
