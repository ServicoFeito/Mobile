import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type {
  PrestadorResumo,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";
import { LIMITE_PAGINA } from "./usePrestadoresPorCategoria";

export function useBuscarPrestadores(termo: string, filtros: FiltrosPrestador) {
  return useInfiniteQuery<Pagina<PrestadorResumo>>({
    queryKey: ["prestadores", "buscar", termo, filtros],
    enabled: termo.trim().length >= 2,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.prestadores.buscar(termo, filtros, {
        limite: LIMITE_PAGINA,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
