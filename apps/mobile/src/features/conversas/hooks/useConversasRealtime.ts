import { useEffect } from "react";
import { supabase } from "@/shared/api/supabaseClient";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";

export function useConversasRealtime(): void {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  useEffect(() => {
    if (!usuarioId) return;
    const bump = () =>
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
    const canal = supabase
      .channel(`conversas:${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversas",
          filter: `cliente_id=eq.${usuarioId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversas",
          filter: `prestador_id=eq.${usuarioId}`,
        },
        bump,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId]);
}
