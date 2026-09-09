import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";
import { enderecosRepositorySupabase } from "./enderecos/enderecosRepository.supabase";
import { demandasRepositorySupabase } from "./demandas/demandasRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
  enderecos: enderecosRepositorySupabase,
  demandas: demandasRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export type { EnderecosRepository } from "./enderecos/enderecosRepository";
export type { DemandasRepository } from "./demandas/demandasRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
