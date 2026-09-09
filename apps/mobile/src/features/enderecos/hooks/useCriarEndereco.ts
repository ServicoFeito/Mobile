import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { Endereco, NovoEndereco } from "@/features/enderecos/types/endereco.types";

export type DadosNovoEndereco = Omit<NovoEndereco, "usuarioId">;

export function useCriarEndereco() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<Endereco, unknown, DadosNovoEndereco>({
    mutationFn: (dados) => repositories.enderecos.criar({ ...dados, usuarioId: usuarioId ?? "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enderecos", "meus"] });
    },
  });
}
