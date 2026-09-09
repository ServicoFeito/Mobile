import { View, Text } from "react-native";
import { useUiModeStore } from "@/shared/store/uiModeStore";

export function InicioScreen() {
  const modo = useUiModeStore((s) => s.modo);
  return (
    <View className="flex-1 bg-sf-bg items-center justify-center">
      <Text className="text-lg text-sf-text">Início — modo {modo === "prestar" ? "prestador" : "cliente"}</Text>
      <Text className="text-sf-muted mt-1">(conteúdo no Plano 3)</Text>
    </View>
  );
}
