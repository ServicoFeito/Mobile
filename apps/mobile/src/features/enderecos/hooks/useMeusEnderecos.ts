import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function useMeusEnderecos() {
  return useQuery<Endereco[]>({
    queryKey: ["enderecos", "meus"],
    queryFn: () => repositories.enderecos.listarMeus(),
  });
}
