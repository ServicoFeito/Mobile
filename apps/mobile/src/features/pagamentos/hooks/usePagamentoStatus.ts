import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";

export function usePagamentoStatus(pagamentoId: string | null) {
  return useQuery<Pagamento>({
    queryKey: ["pagamento", pagamentoId],
    enabled: !!pagamentoId,
    queryFn: () => repositories.pagamentos.obterPorId(pagamentoId as string),
    refetchInterval: (query) => (query.state.data?.status === "PROCESSANDO" ? 5000 : false),
  });
}
