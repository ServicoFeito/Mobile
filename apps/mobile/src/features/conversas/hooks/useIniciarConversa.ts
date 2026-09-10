import { useState } from "react";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";

export function useIniciarConversa() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  const [pendente, setPendente] = useState(false);

  async function iniciarDireta(prestadorId: string) {
    setPendente(true);
    try {
      const r = await repositories.conversas.iniciarDireta(usuarioId ?? "", prestadorId);
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
      return r;
    } finally {
      setPendente(false);
    }
  }

  async function iniciarDemanda(demandaId: string, prestadorId: string) {
    setPendente(true);
    try {
      const r = await repositories.conversas.iniciarDemanda(demandaId, prestadorId);
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
      return r;
    } finally {
      setPendente(false);
    }
  }

  return { iniciarDireta, iniciarDemanda, pendente };
}
