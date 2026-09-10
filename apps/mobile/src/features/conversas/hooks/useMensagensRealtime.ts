import { useEffect } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { queryClient } from "@/shared/query/queryClient";
import type { Pagina } from "@/shared/api/repositories";
import type { Mensagem } from "@/features/conversas/types/conversa.types";

function linhaParaMensagem(r: Record<string, unknown>): Mensagem {
  return {
    id: String(r.id),
    conversaId: String(r.conversa_id),
    remetenteId: String(r.remetente_id),
    tipo: String(r.tipo),
    corpo: typeof r.corpo === "string" ? r.corpo : "",
    propostaId: r.proposta_id == null ? null : String(r.proposta_id),
    lida: Boolean(r.lida),
    createdAt: String(r.created_at),
  };
}

export function useMensagensRealtime(conversaId: string): void {
  useEffect(() => {
    if (!conversaId) return;
    const chave = ["mensagens", conversaId] as const;
    const canal = supabase
      .channel(`msgs:${conversaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const nova = linhaParaMensagem(payload.new as Record<string, unknown>);
          queryClient.setQueryData<InfiniteData<Pagina<Mensagem>>>(chave, (prev) => {
            if (!prev || prev.pages.length === 0) return prev;
            if (prev.pages.some((pg) => pg.itens.some((m) => m.id === nova.id))) return prev;
            const [primeira, ...resto] = prev.pages;
            return {
              ...prev,
              pages: [{ ...primeira!, itens: [nova, ...primeira!.itens] }, ...resto],
            };
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          queryClient.invalidateQueries({ queryKey: chave });
        }
      });
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [conversaId]);
}
