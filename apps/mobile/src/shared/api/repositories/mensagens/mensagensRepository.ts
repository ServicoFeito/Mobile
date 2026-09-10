import type { Mensagem } from "@/features/conversas/types/conversa.types";
import type { PageParams, Pagina } from "../types";

export interface MensagensRepository {
  /** Mensagens da conversa em keyset descendente (mais nova primeiro). */
  listar(conversaId: string, page: PageParams): Promise<Pagina<Mensagem>>;
  /** Envia uma mensagem de texto e devolve a linha criada. */
  enviarTexto(conversaId: string, corpo: string, remetenteId: string): Promise<Mensagem>;
  /** Marca as mensagens do outro como lidas e zera o contador do papel. */
  marcarLidas(
    conversaId: string,
    usuarioId: string,
    papel: "CLIENTE" | "PRESTADOR",
  ): Promise<void>;
}
