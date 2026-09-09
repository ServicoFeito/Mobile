import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { usePrestadoresPorCategoria } from "@/features/descoberta/hooks/usePrestadoresPorCategoria";
import { PrestadorCard } from "@/features/descoberta/components/PrestadorCard";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function PrestadoresPorCategoriaScreen({ categoriaId }: { categoriaId: string }) {
  const q = usePrestadoresPorCategoria(categoriaId, {});

  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  if (itens.length === 0) return <VazioEstado mensagem="Nenhum prestador nesta categoria ainda." />;

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3">
      <FlatList
        data={itens}
        keyExtractor={(p) => p.usuarioId}
        renderItem={({ item }) => (
          <PrestadorCard prestador={item} onPress={() => router.push(`/(app)/prestador/${item.usuarioId}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
      />
    </View>
  );
}
