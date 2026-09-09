import { View, Text } from "react-native";

export function VagasScreen() {
  return (
    <View className="flex-1 bg-sf-bg items-center justify-center">
      <Text className="text-lg text-sf-text">Vagas / demandas abertas</Text>
      <Text className="text-sf-muted mt-1">(conteúdo no Plano 3)</Text>
    </View>
  );
}
