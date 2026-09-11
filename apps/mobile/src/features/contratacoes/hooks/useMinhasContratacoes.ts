import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { useAuthStore } from "@/shared/store/authStore";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";

export function useMinhasContratacoes() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Contratacao[]>({
    queryKey: ["contratacoes", "minhas"],
    enabled: !!usuarioId,
    queryFn: () => repositories.contratacoes.listarMinhas(usuarioId ?? ""),
  });
}
