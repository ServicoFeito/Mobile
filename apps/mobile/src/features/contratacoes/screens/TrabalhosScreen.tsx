import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { ContratacaoRow } from "@/features/contratacoes/components/ContratacaoRow";
import { useMinhasContratacoes } from "@/features/contratacoes/hooks/useMinhasContratacoes";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function TrabalhosScreen() {
  const q = useMinhasContratacoes();

  return (
    <View className="flex-1 bg-sf-bg">
      {q.isLoading ? (
        <CarregandoEstado />
      ) : q.isError || !q.data ? (
        <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <VazioEstado mensagem="Nenhuma contratação ainda." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ContratacaoRow contratacao={item} onPress={() => router.push(`/contratacao/${item.propostaId}`)} />
          )}
        />
      )}
    </View>
  );
}
