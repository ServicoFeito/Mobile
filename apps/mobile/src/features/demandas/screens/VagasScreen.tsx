import { useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { SeletorCategoria } from "@/features/demandas/components/SeletorCategoria";
import { DemandaCard } from "@/features/demandas/components/DemandaCard";
import { useDemandasAbertas } from "@/features/demandas/hooks/useDemandasAbertas";
import { useDebounce } from "@/shared/lib/useDebounce";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function VagasScreen() {
  const [termo, setTermo] = useState("");
  const [cidade, setCidade] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const termoD = useDebounce(termo.trim(), 300);
  const cidadeD = useDebounce(cidade.trim(), 300);

  const q = useDemandasAbertas({
    termo: termoD.length >= 2 ? termoD : undefined,
    cidade: cidadeD || undefined,
    categoriaId: categoriaId ?? undefined,
  });

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3 gap-2">
      <CampoTexto placeholder="Buscar por título…" value={termo} onChangeText={setTermo} autoCapitalize="none" />
      <CampoTexto placeholder="Cidade (opcional)" value={cidade} onChangeText={setCidade} autoCapitalize="words" />
      <SeletorCategoria categoriaId={categoriaId} onSelecionar={(id) => setCategoriaId((a) => (a === id ? null : id))} />

      {q.isLoading ? (
        <CarregandoEstado />
      ) : q.isError ? (
        <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <VazioEstado mensagem="Nenhuma demanda aberta com esses filtros." />
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DemandaCard demanda={item} onPress={() => router.push(`/(app)/demanda/${item.id}`)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}
