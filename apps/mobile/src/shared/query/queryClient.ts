import { QueryClient, QueryCache } from "@tanstack/react-query";

export function notificarErroGlobal(msg: string): void {
  // Substituído por um toast real numa task de UI futura.
  console.warn("[erro]", msg);
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
  queryCache: new QueryCache({
    onError: (erro) => {
      notificarErroGlobal(erro instanceof Error ? erro.message : "Erro inesperado");
    },
  }),
});

export function limparCacheQuery(): void {
  queryClient.clear();
}
