import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { PrestadorPerfil } from "@/features/prestadores/types/prestador.types";

export function usePrestadorPerfil(usuarioId: string) {
  return useQuery<PrestadorPerfil>({
    queryKey: ["prestadores", "perfil", usuarioId],
    enabled: !!usuarioId,
    queryFn: () => repositories.prestadores.obterPerfil(usuarioId),
  });
}
