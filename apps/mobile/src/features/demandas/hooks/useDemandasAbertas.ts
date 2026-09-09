import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type { DemandaResumo, FiltrosDemanda } from "@/features/demandas/types/demanda.types";
import { LIMITE_PAGINA } from "@/features/descoberta/hooks/usePrestadoresPorCategoria";

export function useDemandasAbertas(filtros: FiltrosDemanda) {
  return useInfiniteQuery<Pagina<DemandaResumo>>({
    queryKey: ["demandas", "abertas", filtros],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.demandas.listarAbertas(filtros, {
        limite: LIMITE_PAGINA,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
