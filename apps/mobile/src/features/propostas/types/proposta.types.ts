export interface Proposta {
  id: string;
  demandaId: string | null;
  conversaId: string;
  prestadorId: string;
  clienteId: string;
  valor: number;
  taxaPlataforma: number | null;
  valorLiquidoPrestador: number | null;
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;
  status: string;
  createdAt: string;
}

export interface NovaProposta {
  conversaId: string;
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  valor: number;
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;
}
