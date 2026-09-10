import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type { Mensagem } from "@/features/conversas/types/conversa.types";

export const LIMITE_MENSAGENS = 30;

export function useMensagensInfinite(conversaId: string) {
  return useInfiniteQuery<Pagina<Mensagem>>({
    queryKey: ["mensagens", conversaId],
    enabled: !!conversaId,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.mensagens.listar(conversaId, {
        limite: LIMITE_MENSAGENS,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
