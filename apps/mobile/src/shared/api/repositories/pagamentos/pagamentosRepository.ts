import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";

export interface PagamentosRepository {
  /** Pagamento PENDENTE/PROCESSANDO mais recente da contratação, ou `null` se não houver. */
  buscarPendente(contratacaoId: string): Promise<Pagamento | null>;
  /** Aciona a criação da cobrança Pix via edge function e relê o pagamento atualizado. */
  criarCobranca(pagamentoId: string): Promise<Pagamento>;
  obterPorId(pagamentoId: string): Promise<Pagamento>;
}
