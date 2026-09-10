import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { useAuthStore } from "@/shared/store/authStore";
import type { Conversa } from "@/features/conversas/types/conversa.types";

export function useConversa(id: string) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Conversa>({
    queryKey: ["conversa", id],
    enabled: !!id && !!usuarioId,
    queryFn: () => repositories.conversas.obter(id, usuarioId ?? ""),
  });
}
