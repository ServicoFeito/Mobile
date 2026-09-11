import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { useAuthStore } from "@/shared/store/authStore";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";

export function useContratacaoPorProposta(propostaId: string) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Contratacao>({
    queryKey: ["contratacao", "proposta", propostaId],
    enabled: !!propostaId && !!usuarioId,
    queryFn: () => repositories.contratacoes.obterPorProposta(propostaId, usuarioId ?? ""),
  });
}
