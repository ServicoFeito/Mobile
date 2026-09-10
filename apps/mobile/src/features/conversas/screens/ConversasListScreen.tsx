import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { ConversaRow } from "@/features/conversas/components/ConversaRow";
import { useMinhasConversas } from "@/features/conversas/hooks/useMinhasConversas";
import { useConversasRealtime } from "@/features/conversas/hooks/useConversasRealtime";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function ConversasListScreen() {
  useConversasRealtime();
  const q = useMinhasConversas();

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3">
      {q.isLoading ? (
        <CarregandoEstado />
      ) : q.isError || !q.data ? (
        <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <VazioEstado mensagem="Nenhuma conversa ainda." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversaRow conversa={item} onPress={() => router.push(`/conversa/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
