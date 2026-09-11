import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useDemanda } from "@/features/demandas/hooks/useDemanda";
import { useIniciarConversa } from "@/features/conversas/hooks/useIniciarConversa";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { useAuthStore } from "@/shared/store/authStore";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function DemandaDetalheScreen({ id }: { id: string }) {
  const q = useDemanda(id);
  const usuarioId = useAuthStore((s) => s.usuarioId);
  const modo = useUiModeStore((s) => s.modo);
  const { iniciarDemanda, pendente } = useIniciarConversa();
  const [erroConversa, setErroConversa] = useState<string | null>(null);
  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError || !q.data) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const d = q.data;
  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-2xl font-bold text-sf-text">{d.titulo}</Text>
      <Text className="text-sf-muted text-sm mt-0.5">{d.categoriaNome} · {d.urgencia}</Text>
      <Text className="text-sf-body mt-3">{d.descricao}</Text>

      <View className="mt-3 gap-0.5">
        {d.clienteNome ? <Text className="text-sf-body text-sm">Cliente: {d.clienteNome}</Text> : null}
        <Text className="text-sf-body text-sm">
          Local: {[d.enderecoCompleto, d.enderecoBairro, d.enderecoCidade].filter(Boolean).join(" · ") || "não informado"}
        </Text>
        {d.orcamentoMaximo != null ? (
          <Text className="text-sf-body text-sm">Orçamento máximo: R$ {d.orcamentoMaximo}</Text>
        ) : null}
        {d.dataDesejada ? <Text className="text-sf-body text-sm">Data desejada: {d.dataDesejada}</Text> : null}
        <Text className="text-sf-muted text-xs mt-1">{d.totalPropostas} proposta(s)</Text>
      </View>

      {modo === "prestar" ? (
        <View className="mt-6 mb-10">
          <Botao
            titulo="Tenho interesse"
            carregando={pendente}
            onPress={async () => {
              setErroConversa(null);
              try {
                const r = await iniciarDemanda(id, usuarioId ?? "");
                router.push(`/conversa/${r.id}`);
              } catch (e) {
                setErroConversa(traduzErroRepo(e));
              }
            }}
          />
          {erroConversa ? <Text className="text-sf-status-red mt-2">{erroConversa}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
