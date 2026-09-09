import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Wrapper de testes p/ hooks react-query. gcTime 0 = sem setTimeout de GC pendurado (senão o jest não sai). */
export function criarWrapperQuery() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
