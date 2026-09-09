import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export function useCategorias() {
  return useQuery<Categoria[]>({
    queryKey: ["categorias", "listar"],
    staleTime: 5 * 60_000,
    queryFn: () => repositories.categorias.listar(),
  });
}
