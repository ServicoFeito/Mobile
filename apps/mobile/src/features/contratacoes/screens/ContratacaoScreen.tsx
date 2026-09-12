import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { RepoError } from "@/shared/api/repositories";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import { formatarBRL } from "@/shared/lib/formatarBRL";
import { useAuthStore } from "@/shared/store/authStore";
import { statusContratacaoLabel } from "@/features/contratacoes/lib/statusContratacaoLabel";
import { useContratacaoPorProposta } from "@/features/contratacoes/hooks/useContratacaoPorProposta";
import { useCancelarContratacao } from "@/features/contratacoes/hooks/useCancelarContratacao";
import { useTarefasDaDemanda } from "@/features/tarefas/hooks/useTarefasDaDemanda";
import { useMarcarTarefaConcluida } from "@/features/tarefas/hooks/useMarcarTarefaConcluida";
import { TarefaRow } from "@/features/tarefas/components/TarefaRow";
import { usePagamentoPendente } from "@/features/pagamentos/hooks/usePagamentoPendente";
import { useIniciarExecucao } from "@/features/contratacoes/hooks/useIniciarExecucao";
import { useConcluirExecucao } from "@/features/contratacoes/hooks/useConcluirExecucao";

const ERRO_CONTRATACAO_GENERICO = "Não foi possível concluir. Tente de novo.";

export function erroContratacao(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof RepoError) {
    switch (e.code) {
      case "nao_autorizado":
        return "Você não pode cancelar esta contratação.";
      case "conflito":
        return "Esta contratação não pode mais ser cancelada.";
      case "nao_encontrado":
        return "Contratação não encontrada.";
      default:
        return ERRO_CONTRATACAO_GENERICO;
    }
  }
  return ERRO_CONTRATACAO_GENERICO;
}

export function ContratacaoScreen({ id }: { id: string }) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  const cq = useContratacaoPorProposta(id);
  const c = cq.data;

  const tarefasQ = useTarefasDaDemanda(c?.demandaId ?? "");
  const marcarTarefa = useMarcarTarefaConcluida(c?.demandaId ?? "");
  const cancelar = useCancelarContratacao(id, c?.demandaId ?? null);
  const pendenteQ = usePagamentoPendente(c?.id ?? "");
  const iniciar = useIniciarExecucao(id);
  const concluir = useConcluirExecucao(id);

  if (cq.isLoading) return <CarregandoEstado />;
  if (cq.isError || !c) {
    return <ErroEstado mensagem={traduzErroRepo(cq.error)} onRetry={() => cq.refetch()} />;
  }

  const souCliente = usuarioId === c.clienteId;

  function confirmarCancelamento() {
    Alert.alert(
      "Cancelar contratação?",
      "Isso não pode ser desfeito.",
      [
        { text: "Voltar", style: "cancel" },
        { text: "Cancelar contratação", style: "destructive", onPress: () => cancelar.mutate(c!.id) },
      ],
    );
  }

  return (
    <View className="flex-1 bg-sf-bg">
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-sf-outline bg-sf-bg">
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text className="text-sf-primary text-base">‹ Voltar</Text>
        </Pressable>
        <Text className="text-sf-text text-lg font-semibold" numberOfLines={1}>
          Contratação
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-2xl font-bold text-sf-text">{c.tituloServico}</Text>
        <Text className="text-sf-muted text-sm mt-0.5">{statusContratacaoLabel(c.status)}</Text>
        <Text className="text-sf-text text-lg font-semibold mt-2">{formatarBRL(c.valorTotal)}</Text>
        <Text className="text-sf-body text-sm mt-1">{c.outroNome ?? "Usuário"}</Text>

        {c.status === "AGUARDANDO_PAGAMENTO" ? (
          <View className="mt-6">
            <Botao
              titulo="Cancelar contratação"
              variante="perigo"
              carregando={cancelar.isPending}
              onPress={confirmarCancelamento}
            />
            {erroContratacao(cancelar.error) ? (
              <Text className="text-sf-status-red mt-2">{erroContratacao(cancelar.error)}</Text>
            ) : null}
          </View>
        ) : null}

        {souCliente && pendenteQ.data ? (
          <View className="mt-6">
            <Botao
              titulo={pendenteQ.data.tipo === "ENTRADA" ? "Pagar entrada" : "Pagar final"}
              onPress={() => router.push(`/pagamento/${c.id}`)}
            />
          </View>
        ) : null}

        {!souCliente && c.status === "AGENDADA" ? (
          <View className="mt-6">
            <Botao
              titulo="Iniciar serviço"
              carregando={iniciar.isPending}
              onPress={() => iniciar.mutate(c.id)}
            />
            {erroContratacao(iniciar.error) ? (
              <Text className="text-sf-status-red mt-2">{erroContratacao(iniciar.error)}</Text>
            ) : null}
          </View>
        ) : null}

        {!souCliente && c.status === "EM_ANDAMENTO" && !pendenteQ.data ? (
          <View className="mt-6">
            <Botao
              titulo="Finalizar serviço"
              carregando={concluir.isPending}
              onPress={() => concluir.mutate(c.id)}
            />
            {erroContratacao(concluir.error) ? (
              <Text className="text-sf-status-red mt-2">{erroContratacao(concluir.error)}</Text>
            ) : null}
          </View>
        ) : null}

        {c.demandaId && (tarefasQ.data ?? []).length > 0 ? (
          <View className="mt-6 mb-10">
            <Text className="text-sf-text font-semibold mb-1">Tarefas</Text>
            {(tarefasQ.data ?? []).map((t) => (
              <TarefaRow
                key={t.id}
                tarefa={t}
                interativo={souCliente}
                onToggle={() => marcarTarefa.mutate({ tarefaId: t.id, concluida: !t.concluida })}
              />
            ))}
          </View>
        ) : (
          <View className="mb-10" />
        )}
      </ScrollView>
    </View>
  );
}
