import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { DemandaDetalhe } from "@/features/demandas/types/demanda.types";

export function useDemanda(id: string) {
  return useQuery<DemandaDetalhe>({
    queryKey: ["demandas", "detalhe", id],
    enabled: !!id,
    queryFn: () => repositories.demandas.obter(id),
  });
}
