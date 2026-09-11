export interface Tarefa {
  id: string;
  demandaId: string;
  nomeTarefa: string;
  descricao: string | null;
  concluida: boolean;
  createdAt: string;
}
