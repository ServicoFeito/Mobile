import { View, Text } from "react-native";
import { usePerfilAtual } from "@/features/perfil/hooks/usePerfilAtual";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { useAuthStore } from "@/shared/store/authStore";
import { limparCacheQuery } from "@/shared/query/queryClient";
import { Botao } from "@/shared/components/atoms/Botao";

export function PerfilScreen() {
  const { data: perfil } = usePerfilAtual();
  const modo = useUiModeStore((s) => s.modo);

  return (
    <View className="flex-1 bg-sf-bg px-6 pt-6 gap-4">
      <Text className="text-2xl font-bold text-sf-text">{perfil?.nome ?? "Perfil"}</Text>
      <Text className="text-sf-body">{perfil?.cidade ?? ""}</Text>

      <Botao
        titulo={`Alternar para modo ${modo === "contratar" ? "prestar serviço" : "contratar"}`}
        variante="secundario"
        onPress={() => useUiModeStore.getState().alternar()}
      />

      <View className="mt-auto mb-8">
        <Botao
          titulo="Sair"
          variante="perigo"
          onPress={async () => {
            await useAuthStore.getState().sair();
            limparCacheQuery();
          }}
        />
      </View>
    </View>
  );
}
