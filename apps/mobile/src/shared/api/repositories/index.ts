import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";
import { enderecosRepositorySupabase } from "./enderecos/enderecosRepository.supabase";
import { demandasRepositorySupabase } from "./demandas/demandasRepository.supabase";
import { prestadoresRepositorySupabase } from "./prestadores/prestadoresRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
  enderecos: enderecosRepositorySupabase,
  demandas: demandasRepositorySupabase,
  prestadores: prestadoresRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export type { EnderecosRepository } from "./enderecos/enderecosRepository";
export type { DemandasRepository } from "./demandas/demandasRepository";
export type { PrestadoresRepository } from "./prestadores/prestadoresRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
