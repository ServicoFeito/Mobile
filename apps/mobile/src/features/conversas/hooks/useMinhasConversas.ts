import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { useAuthStore } from "@/shared/store/authStore";
import type { Conversa } from "@/features/conversas/types/conversa.types";

export function useMinhasConversas() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Conversa[]>({
    queryKey: ["conversas", "minhas"],
    enabled: !!usuarioId,
    queryFn: () => repositories.conversas.listarMinhas(usuarioId ?? ""),
  });
}
