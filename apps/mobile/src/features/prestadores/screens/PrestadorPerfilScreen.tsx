import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { usePrestadorPerfil } from "@/features/prestadores/hooks/usePrestadorPerfil";
import { PortfolioGaleria } from "@/features/prestadores/components/PortfolioGaleria";
import { DisponibilidadeChips } from "@/features/prestadores/components/DisponibilidadeChips";
import { useIniciarConversa } from "@/features/conversas/hooks/useIniciarConversa";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { useAuthStore } from "@/shared/store/authStore";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function PrestadorPerfilScreen({ usuarioId }: { usuarioId: string }) {
  const q = usePrestadorPerfil(usuarioId);
  const usuarioAtualId = useAuthStore((s) => s.usuarioId);
  const { iniciarDireta, pendente } = useIniciarConversa();
  const [erroConversa, setErroConversa] = useState<string | null>(null);

  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError || !q.data) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const p = q.data;
  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-2xl font-bold text-sf-text">{p.nome ?? "Prestador"}</Text>
      {p.tituloProfissional ? <Text className="text-sf-body mt-0.5">{p.tituloProfissional}</Text> : null}

      {usuarioAtualId !== p.usuarioId ? (
        <View className="mt-3">
          <Botao
            titulo="Conversar"
            variante="secundario"
            carregando={pendente}
            onPress={async () => {
              setErroConversa(null);
              try {
                const r = await iniciarDireta(p.usuarioId);
                router.push(`/conversa/${r.id}`);
              } catch (e) {
                setErroConversa(traduzErroRepo(e));
              }
            }}
          />
          {erroConversa ? <Text className="text-sf-status-red mt-2">{erroConversa}</Text> : null}
        </View>
      ) : null}

      <View className="flex-row gap-3 mt-1">
        {p.rating != null ? <Text className="text-sf-body text-sm">★ {p.rating.toFixed(1)} ({p.totalAvaliacoes ?? 0})</Text> : null}
        {p.cidade ? <Text className="text-sf-muted text-sm">{p.cidade}</Text> : null}
      </View>

      {p.bio ? <Text className="text-sf-body mt-3">{p.bio}</Text> : null}

      {p.precoBase != null ? (
        <Text className="text-sf-text font-semibold mt-3">A partir de R$ {p.precoBase}</Text>
      ) : null}

      {p.categorias.length > 0 ? (
        <View className="mt-3">
          <Text className="text-sf-text font-semibold mb-1">Categorias</Text>
          <View className="flex-row flex-wrap gap-1">
            {p.categorias.map((c) => (
              <View key={c.id} className="px-2 py-1 rounded-full bg-sf-surface-variant">
                <Text className="text-sf-dark-green text-xs">{c.nome}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {p.disponibilidade ? (
        <View className="mt-3">
          <Text className="text-sf-text font-semibold mb-1">Disponibilidade</Text>
          <DisponibilidadeChips disponibilidade={p.disponibilidade} />
        </View>
      ) : null}

      {p.portfolio.length > 0 ? (
        <View className="mt-3 mb-8">
          <Text className="text-sf-text font-semibold mb-1">Portfólio</Text>
          <PortfolioGaleria itens={p.portfolio} />
        </View>
      ) : (
        <View className="mb-8" />
      )}
    </ScrollView>
  );
}
