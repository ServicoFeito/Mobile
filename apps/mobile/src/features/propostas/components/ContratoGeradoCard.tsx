import { Text, View } from "react-native";

export function ContratoGeradoCard({ valor }: { valor: number }) {
  return (
    <View className="bg-sf-surface-variant border border-sf-outline rounded-xl px-4 py-3 mb-2">
      <Text className="text-sf-dark-green text-sm font-semibold">Contrato gerado</Text>
      <Text className="text-sf-text text-base mt-1">R$ {valor.toFixed(2)}</Text>
    </View>
  );
}
