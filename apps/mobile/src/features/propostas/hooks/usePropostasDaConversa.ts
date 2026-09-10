import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Proposta } from "@/features/propostas/types/proposta.types";

export function usePropostasDaConversa(conversaId: string) {
  return useQuery<Proposta[]>({
    queryKey: ["propostas", "conversa", conversaId],
    enabled: !!conversaId,
    queryFn: () => repositories.propostas.daConversa(conversaId),
  });
}
