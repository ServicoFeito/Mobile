export interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  iconeKey: string;
  popular: boolean;
  precoMedioHora: number;
}
