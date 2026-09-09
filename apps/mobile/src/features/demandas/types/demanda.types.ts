export interface DemandaResumo {
  id: string;
  titulo: string;
  descricao: string;
  categoriaId: string;
  categoriaNome: string;
  enderecoCidade: string | null;
  enderecoBairro: string | null;
  orcamentoMaximo: number | null;
  urgencia: string;
  status: string;
  totalPropostas: number;
  createdAt: string;
}

export interface DemandaDetalhe extends DemandaResumo {
  enderecoCompleto: string | null;
  dataDesejada: string | null;
  clienteNome: string | null;
}

export interface NovaDemanda {
  clienteId: string;
  categoriaId: string;
  titulo: string;
  descricao: string;
  orcamentoMaximo: number | null;
  urgencia: string;
  enderecoCidade: string | null;
  enderecoBairro: string | null;
  enderecoCompleto: string | null;
  dataDesejada: string | null;
}

export interface FiltrosDemanda {
  categoriaId?: string;
  cidade?: string;
  termo?: string;
}
