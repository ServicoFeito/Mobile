import { View, Text, Pressable } from "react-native";
import { usePerfilAtual } from "@/features/perfil/hooks/usePerfilAtual";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { useAuthStore } from "@/shared/store/authStore";
import { limparCacheQuery } from "@/shared/query/queryClient";

export function PerfilScreen() {
  const { data: perfil } = usePerfilAtual();
  const modo = useUiModeStore((s) => s.modo);

  return (
    <View className="flex-1 bg-sf-bg px-6 pt-6 gap-4">
      <Text className="text-2xl font-bold text-sf-text">{perfil?.nome ?? "Perfil"}</Text>
      <Text className="text-sf-body">{perfil?.cidade ?? ""}</Text>

      <Pressable
        onPress={() => useUiModeStore.getState().alternar()}
        className="bg-sf-surface-variant rounded-lg py-3 px-4"
      >
        <Text className="text-sf-dark-green font-medium">
          Alternar para modo {modo === "contratar" ? "prestar serviço" : "contratar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await useAuthStore.getState().sair();
          limparCacheQuery();
        }}
        className="mt-auto mb-8 border border-sf-status-red rounded-lg py-3 px-4"
      >
        <Text className="text-sf-status-red font-medium text-center">Sair</Text>
      </Pressable>
    </View>
  );
}
