import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { useAuthStore } from "@/shared/store/authStore";
import type { Mensagem } from "@/features/conversas/types/conversa.types";

export function useEnviarTexto(conversaId: string) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<Mensagem, unknown, string>({
    mutationFn: (corpo) =>
      repositories.mensagens.enviarTexto(conversaId, corpo, usuarioId ?? ""),
  });
}
