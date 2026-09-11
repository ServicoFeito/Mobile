export interface Contratacao {
  id: string;
  demandaId: string | null;
  propostaId: string;
  tituloServico: string;
  clienteId: string;
  prestadorId: string;
  valorTotal: number;
  valorEntrada: number | null;
  valorFinal: number | null;
  taxaPlataforma: number | null;
  status: string;
  entradaPaga: boolean;
  finalPago: boolean;
  avaliado: boolean;
  dataAgendada: string | null;
  dataConclusao: string | null;
  outroId: string;
  outroNome: string | null;
  outroFotoUrl: string | null;
  createdAt: string;
}
