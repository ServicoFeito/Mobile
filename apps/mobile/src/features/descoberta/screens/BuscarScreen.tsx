import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { CategoriaCard } from "@/features/descoberta/components/CategoriaCard";
import { PrestadorCard } from "@/features/descoberta/components/PrestadorCard";
import { useCategorias } from "@/features/descoberta/hooks/useCategorias";
import { useBuscarPrestadores } from "@/features/descoberta/hooks/useBuscarPrestadores";
import { useDebounce } from "@/shared/lib/useDebounce";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function BuscarScreen() {
  const [termo, setTermo] = useState("");
  const [cidade, setCidade] = useState("");
  const termoDebounced = useDebounce(termo.trim(), 300);
  const cidadeDebounced = useDebounce(cidade.trim(), 300);
  const buscando = termoDebounced.length >= 2;

  const cats = useCategorias();
  const busca = useBuscarPrestadores(termoDebounced, cidadeDebounced ? { cidade: cidadeDebounced } : {});

  const catsFiltradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    const lista = cats.data ?? [];
    return t.length > 0 ? lista.filter((c) => c.nome.toLowerCase().includes(t)) : lista;
  }, [cats.data, termo]);

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3 gap-2">
      <CampoTexto placeholder="O que você precisa? Ex: diarista, pintor…" value={termo} onChangeText={setTermo} autoCapitalize="none" />
      <CampoTexto placeholder="Cidade (opcional)" value={cidade} onChangeText={setCidade} autoCapitalize="words" />

      {buscando ? (
        busca.isLoading ? (
          <CarregandoEstado />
        ) : busca.isError ? (
          <ErroEstado mensagem={traduzErroRepo(busca.error)} onRetry={() => busca.refetch()} />
        ) : (
          (() => {
            const itens = busca.data?.pages.flatMap((p) => p.itens) ?? [];
            if (itens.length === 0) return <VazioEstado mensagem="Nenhum prestador encontrado." />;
            return (
              <FlatList
                data={itens}
                keyExtractor={(p) => p.usuarioId}
                renderItem={({ item }) => (
                  <PrestadorCard prestador={item} onPress={() => router.push(`/(app)/prestador/${item.usuarioId}`)} />
                )}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (busca.hasNextPage && !busca.isFetchingNextPage) busca.fetchNextPage();
                }}
              />
            );
          })()
        )
      ) : cats.isLoading ? (
        <CarregandoEstado />
      ) : cats.isError ? (
        <ErroEstado mensagem={traduzErroRepo(cats.error)} onRetry={() => cats.refetch()} />
      ) : (
        <FlatList
          data={catsFiltradas}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CategoriaCard categoria={item} onPress={() => router.push(`/(app)/categoria/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
