import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useAuthStore } from "@/shared/store/authStore";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { RepoError } from "@/shared/api/repositories";
import { Botao } from "@/shared/components/atoms/Botao";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import type { Mensagem } from "@/features/conversas/types/conversa.types";
import { useConversa } from "@/features/conversas/hooks/useConversa";
import { useMensagensInfinite } from "@/features/conversas/hooks/useMensagensInfinite";
import { useMensagensRealtime } from "@/features/conversas/hooks/useMensagensRealtime";
import { useEnviarTexto } from "@/features/conversas/hooks/useEnviarTexto";
import { useMarcarLidas } from "@/features/conversas/hooks/useMarcarLidas";
import { BolhaMensagem } from "@/features/conversas/components/BolhaMensagem";
import { usePropostasDaConversa } from "@/features/propostas/hooks/usePropostasDaConversa";
import { useAceitarProposta } from "@/features/propostas/hooks/useAceitarProposta";
import { useRecusarProposta } from "@/features/propostas/hooks/useRecusarProposta";
import { PropostaCard } from "@/features/propostas/components/PropostaCard";
import { ContratoGeradoCard } from "@/features/propostas/components/ContratoGeradoCard";

const ERRO_PROPOSTA_GENERICO = "Não foi possível concluir. Tente de novo.";

export function erroProposta(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof RepoError) {
    switch (e.code) {
      case "nao_autorizado":
        return "Só o cliente da demanda pode aceitar esta proposta.";
      case "conflito":
        return "Esta proposta não está mais disponível.";
      case "nao_encontrado":
        return "Proposta não encontrada.";
      default:
        return ERRO_PROPOSTA_GENERICO;
    }
  }
  return ERRO_PROPOSTA_GENERICO;
}

export function ConversaScreen({ id }: { id: string }) {
  useMensagensRealtime(id);

  const usuarioId = useAuthStore((s) => s.usuarioId);
  const modo = useUiModeStore((s) => s.modo);
  const focado = useIsFocused();

  const conversaQ = useConversa(id);
  const mensagensQ = useMensagensInfinite(id);
  const propostasQ = usePropostasDaConversa(id);

  const enviar = useEnviarTexto(id);
  const marcarLidas = useMarcarLidas(id);
  const aceitar = useAceitarProposta(id, conversaQ.data?.demandaId ?? null);
  const recusar = useRecusarProposta(id);

  const [texto, setTexto] = useState("");

  const mensagens = (mensagensQ.data?.pages ?? []).flatMap((p) => p.itens);

  useEffect(() => {
    marcarLidas.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!focado) return;
    const ultima = mensagens[0];
    if (ultima && ultima.remetenteId !== usuarioId && ultima.lida === false) {
      marcarLidas.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens.length, focado]);

  if (mensagensQ.isLoading || conversaQ.isLoading) return <CarregandoEstado />;
  if (mensagensQ.isError || conversaQ.isError) {
    return (
      <ErroEstado
        mensagem={traduzErroRepo(mensagensQ.error ?? conversaQ.error)}
        onRetry={() => {
          mensagensQ.refetch();
          conversaQ.refetch();
        }}
      />
    );
  }

  const meuId = usuarioId ?? "";
  const souCliente = usuarioId === conversaQ.data?.clienteId;
  const podeEnviarProposta =
    modo === "prestar" && usuarioId === conversaQ.data?.prestadorId;

  function renderItem({ item }: { item: Mensagem }) {
    if (item.tipo === "PROPOSTA") {
      const p = propostasQ.data?.find((x) => x.id === item.propostaId);
      if (p) {
        return (
          <PropostaCard
            proposta={p}
            souCliente={souCliente}
            onAceitar={() => {
              if (item.propostaId) aceitar.mutate(item.propostaId);
            }}
            onRecusar={() => {
              if (item.propostaId) recusar.mutate(item.propostaId);
            }}
            erro={erroProposta(aceitar.error ?? recusar.error)}
            ocupado={aceitar.isPending || recusar.isPending}
          />
        );
      }
      return <BolhaMensagem mensagem={item} meuId={meuId} />;
    }
    if (item.tipo === "CONTRATO_GERADO") {
      const p = propostasQ.data?.find((x) => x.id === item.propostaId);
      return (
        <Pressable
          onPress={() => {
            if (item.propostaId) router.push(`/contratacao/${item.propostaId}`);
          }}
        >
          <ContratoGeradoCard valor={p?.valor ?? 0} />
        </Pressable>
      );
    }
    return <BolhaMensagem mensagem={item} meuId={meuId} />;
  }

  function enviarTexto() {
    const t = texto.trim();
    if (!t) return;
    enviar.mutate(t);
    setTexto("");
  }

  return (
    <View className="flex-1 bg-sf-bg">
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-sf-outline bg-sf-bg">
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text className="text-sf-primary text-base">‹ Voltar</Text>
        </Pressable>
        <Text className="text-sf-text text-lg font-semibold" numberOfLines={1}>
          {conversaQ.data?.outroNome ?? "Usuário"}
        </Text>
      </View>

      {podeEnviarProposta ? (
        <View className="px-4 py-2 border-b border-sf-outline">
          <Botao
            titulo="Enviar proposta"
            variante="secundario"
            onPress={() => router.push(`/conversa/${id}/nova-proposta`)}
          />
        </View>
      ) : null}

      <FlatList
        inverted
        data={mensagens}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-4 py-3"
        onEndReached={() => {
          if (mensagensQ.hasNextPage && !mensagensQ.isFetchingNextPage) {
            void mensagensQ.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={renderItem}
      />

      <View className="flex-row items-center gap-2 px-4 py-2 border-t border-sf-outline">
        <View className="flex-1">
          <CampoTexto value={texto} onChangeText={setTexto} placeholder="Mensagem" />
        </View>
        <Botao
          titulo="Enviar"
          onPress={enviarTexto}
          desabilitado={texto.trim() === "" || enviar.isPending}
        />
      </View>
    </View>
  );
}
