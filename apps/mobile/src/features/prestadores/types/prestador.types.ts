import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export interface PrestadorResumo {
  usuarioId: string;
  nome: string | null;
  cidade: string | null;
  bairro: string | null;
  tituloProfissional: string | null;
  precoBase: number | null;
  rating: number | null;
  totalAvaliacoes: number | null;
  verificado: boolean;
  disponivel: boolean;
  fotoPerfilUrl: string | null;
  avatarCorHex: string | null;
}

export interface ItemPortfolio {
  id: string;
  urlMedia: string;
}

export interface DisponibilidadeSemana {
  dom: boolean;
  seg: boolean;
  ter: boolean;
  qua: boolean;
  qui: boolean;
  sex: boolean;
  sab: boolean;
}

export interface PrestadorPerfil extends PrestadorResumo {
  bio: string | null;
  raioKm: number | null;
  totalServicos: number | null;
  categorias: Categoria[];
  portfolio: ItemPortfolio[];
  disponibilidade: DisponibilidadeSemana | null;
}

export interface FiltrosPrestador {
  cidade?: string;
}
