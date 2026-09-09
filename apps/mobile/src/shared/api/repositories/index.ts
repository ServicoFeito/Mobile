import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
