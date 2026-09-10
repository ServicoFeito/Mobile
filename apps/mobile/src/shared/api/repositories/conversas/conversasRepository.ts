import type { Conversa } from "@/features/conversas/types/conversa.types";

export interface ConversasRepository {
  /** Conversas em que o usuário é cliente ou prestador, mais recentes primeiro. */
  listarMinhas(usuarioId: string): Promise<Conversa[]>;
  /** Uma conversa por id, com o "outro" resolvido para a perspectiva de `usuarioId`. */
  obter(id: string, usuarioId: string): Promise<Conversa>;
  /** Find-or-create de uma conversa DIRETA entre cliente e prestador. */
  iniciarDireta(clienteId: string, prestadorId: string): Promise<{ id: string }>;
  /** Find-or-create de uma conversa DEMANDA (cliente_id vem da demanda). */
  iniciarDemanda(demandaId: string, prestadorId: string): Promise<{ id: string }>;
}
