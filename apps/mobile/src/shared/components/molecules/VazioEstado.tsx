import { View, Text } from "react-native";

export function VazioEstado({ mensagem }: { mensagem: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-sf-muted text-center">{mensagem}</Text>
    </View>
  );
}
