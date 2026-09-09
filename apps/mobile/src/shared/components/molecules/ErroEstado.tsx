import { View, Text, Pressable } from "react-native";

export function ErroEstado({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6 gap-3">
      <Text className="text-sf-status-red text-center">{mensagem}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="bg-sf-primary rounded-lg py-2 px-4">
          <Text className="text-white">Tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
