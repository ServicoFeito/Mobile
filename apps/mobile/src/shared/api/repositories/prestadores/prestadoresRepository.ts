import type { PageParams, Pagina } from "@/shared/api/repositories/types";
import type {
  PrestadorResumo,
  PrestadorPerfil,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";

export interface PrestadoresRepository {
  /** Prestadores de uma categoria. Ordena por rating desc; paginação por OFFSET
   *  (a view perfis_publicos não tem created_at). `page.cursor` = offset serializado. */
  listarPorCategoria(
    categoriaId: string,
    filtros: FiltrosPrestador,
    page: PageParams,
  ): Promise<Pagina<PrestadorResumo>>;
  /** Busca textual (ilike em nome / titulo_profissional). Mesma paginação por offset. */
  buscar(termo: string, filtros: FiltrosPrestador, page: PageParams): Promise<Pagina<PrestadorResumo>>;
  obterPerfil(usuarioId: string): Promise<PrestadorPerfil>;
}
