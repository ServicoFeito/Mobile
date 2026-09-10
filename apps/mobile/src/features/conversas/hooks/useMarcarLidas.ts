import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { Conversa } from "@/features/conversas/types/conversa.types";

type Papel = "CLIENTE" | "PRESTADOR";

function resolverPapel(conversaId: string, usuarioId: string | null): Papel | null {
  if (!usuarioId) return null;
  let conv = queryClient.getQueryData<Conversa>(["conversa", conversaId]);
  if (!conv) {
    const minhas = queryClient.getQueryData<Conversa[]>(["conversas", "minhas"]);
    conv = minhas?.find((c) => c.id === conversaId);
  }
  if (!conv) return null;
  return conv.clienteId === usuarioId ? "CLIENTE" : "PRESTADOR";
}

export function useMarcarLidas(conversaId: string) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<void, unknown, void>({
    mutationFn: () => {
      const papel = resolverPapel(conversaId, usuarioId);
      if (!papel) return Promise.resolve();
      return repositories.mensagens.marcarLidas(conversaId, usuarioId ?? "", papel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
      queryClient.setQueryData<Conversa>(["conversa", conversaId], (c) =>
        c ? { ...c, naoLidas: 0 } : c,
      );
    },
  });
}
