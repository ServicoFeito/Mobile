import type { NovaProposta, Proposta } from "@/features/propostas/types/proposta.types";

export interface PropostasRepository {
  /** Propostas de uma conversa, mais antigas primeiro. */
  daConversa(conversaId: string): Promise<Proposta[]>;
  /** Uma proposta por id. */
  obter(id: string): Promise<Proposta>;
  /** Cria uma proposta (status inicial fica no default do banco, `ENVIADA`). */
  criar(dados: NovaProposta): Promise<{ id: string }>;
  /** Recusa a proposta via RPC (cliente não tem UPDATE direto em `propostas`). */
  recusar(propostaId: string): Promise<void>;
  /** Aceita a proposta via RPC; devolve o id da contratação criada. */
  aceitar(propostaId: string): Promise<{ contratacaoId: string }>;
}
