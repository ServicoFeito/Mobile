import type { Endereco, NovoEndereco } from "@/features/enderecos/types/endereco.types";

export interface EnderecosRepository {
  /** Endereços do usuário logado (RLS: só o dono), mais recentes primeiro. */
  listarMeus(): Promise<Endereco[]>;
  criar(dados: NovoEndereco): Promise<Endereco>;
}
