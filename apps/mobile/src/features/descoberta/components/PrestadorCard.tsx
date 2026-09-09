import { Pressable, Text, View } from "react-native";
import type { PrestadorResumo } from "@/features/prestadores/types/prestador.types";

export function PrestadorCard({ prestador, onPress }: { prestador: PrestadorResumo; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-row justify-between">
        <Text className="text-sf-text font-semibold">{prestador.nome ?? "Prestador"}</Text>
        {prestador.rating != null ? (
          <Text className="text-sf-body text-sm">★ {prestador.rating.toFixed(1)}</Text>
        ) : null}
      </View>
      {prestador.tituloProfissional ? (
        <Text className="text-sf-body text-sm mt-0.5">{prestador.tituloProfissional}</Text>
      ) : null}
      <View className="flex-row justify-between mt-1">
        <Text className="text-sf-muted text-xs">{prestador.cidade ?? ""}</Text>
        {prestador.precoBase != null ? (
          <Text className="text-sf-muted text-xs">a partir de R$ {prestador.precoBase}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
