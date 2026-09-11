import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";

export interface ContratacoesRepository {
  /** Uma contratação por proposta, com o "outro" resolvido para a perspectiva de `usuarioId`. */
  obterPorProposta(propostaId: string, usuarioId: string): Promise<Contratacao>;
  /** Contratações em que o usuário é cliente ou prestador, mais recentes primeiro. */
  listarMinhas(usuarioId: string): Promise<Contratacao[]>;
  /** Cancela a contratação via RPC. */
  cancelar(contratacaoId: string): Promise<void>;
  /** Inicia a execução do serviço via RPC. */
  iniciarExecucao(contratacaoId: string): Promise<void>;
  /** Conclui a execução do serviço via RPC. Devolve o `pagamento_id` gerado. */
  concluirExecucao(contratacaoId: string): Promise<string>;
}
