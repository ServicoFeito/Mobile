import { ScrollView, Text, View } from "react-native";
import { useDemanda } from "@/features/demandas/hooks/useDemanda";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function DemandaDetalheScreen({ id }: { id: string }) {
  const q = useDemanda(id);
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

      <Text className="text-sf-muted text-xs mt-6 mb-10">
        Iniciar conversa com o cliente estará disponível em breve.
      </Text>
    </ScrollView>
  );
}
