import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";

export function useCriarCobranca() {
  return useMutation<Pagamento, unknown, string>({
    mutationFn: (pagamentoId) => repositories.pagamentos.criarCobranca(pagamentoId),
    onSuccess: (pagamento) => {
      queryClient.setQueryData(["pagamento", pagamento.id], pagamento);
    },
  });
}
