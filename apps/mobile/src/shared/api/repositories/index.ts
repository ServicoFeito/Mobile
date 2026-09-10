import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";
import { enderecosRepositorySupabase } from "./enderecos/enderecosRepository.supabase";
import { demandasRepositorySupabase } from "./demandas/demandasRepository.supabase";
import { prestadoresRepositorySupabase } from "./prestadores/prestadoresRepository.supabase";
import { conversasRepositorySupabase } from "./conversas/conversasRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
  enderecos: enderecosRepositorySupabase,
  demandas: demandasRepositorySupabase,
  prestadores: prestadoresRepositorySupabase,
  conversas: conversasRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export type { EnderecosRepository } from "./enderecos/enderecosRepository";
export type { DemandasRepository } from "./demandas/demandasRepository";
export type { PrestadoresRepository } from "./prestadores/prestadoresRepository";
export type { ConversasRepository } from "./conversas/conversasRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
