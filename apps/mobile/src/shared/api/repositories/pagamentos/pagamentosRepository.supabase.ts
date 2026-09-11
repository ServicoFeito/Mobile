import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";
import type { PagamentosRepository } from "./pagamentosRepository";
import { normalizarErro } from "../types";

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
      if (error) throw normalizarErro(error);

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
