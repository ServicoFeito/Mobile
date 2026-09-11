import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";

export function usePagamentoPendente(contratacaoId: string) {
  return useQuery<Pagamento | null>({
    queryKey: ["pagamento", "pendente", contratacaoId],
    enabled: !!contratacaoId,
    queryFn: () => repositories.pagamentos.buscarPendente(contratacaoId),
  });
}
