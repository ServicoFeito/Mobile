export type TipoConversa = "DEMANDA" | "DIRETA";

export interface Conversa {
  id: string;
  tipo: TipoConversa;
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  status: string;
  ultimaMensagem: string | null;
  dataUltimaMensagem: string | null;
  naoLidas: number;
  outroId: string;
  outroNome: string | null;
  outroFotoUrl: string | null;
  createdAt: string;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  remetenteId: string;
  tipo: string;
  corpo: string;
  propostaId: string | null;
  lida: boolean;
  createdAt: string;
}
