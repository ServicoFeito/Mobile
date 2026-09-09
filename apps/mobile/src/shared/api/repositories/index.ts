import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";
import { enderecosRepositorySupabase } from "./enderecos/enderecosRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
  enderecos: enderecosRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export type { EnderecosRepository } from "./enderecos/enderecosRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
