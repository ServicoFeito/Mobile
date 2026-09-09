import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type {
  PrestadorResumo,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";

export const LIMITE_PAGINA = 20;

export function usePrestadoresPorCategoria(categoriaId: string, filtros: FiltrosPrestador) {
  return useInfiniteQuery<Pagina<PrestadorResumo>>({
    queryKey: ["prestadores", "porCategoria", categoriaId, filtros],
    enabled: !!categoriaId,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      repositories.prestadores.listarPorCategoria(categoriaId, filtros, {
        limite: LIMITE_PAGINA,
        cursor: (pageParam ?? undefined) as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor,
  });
}
