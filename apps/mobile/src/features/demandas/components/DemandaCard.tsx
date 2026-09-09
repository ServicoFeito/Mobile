import { Pressable, Text, View } from "react-native";
import type { DemandaResumo } from "@/features/demandas/types/demanda.types";

export function DemandaCard({ demanda, onPress }: { demanda: DemandaResumo; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-row justify-between">
        <Text className="text-sf-text font-semibold" numberOfLines={1}>{demanda.titulo}</Text>
        <Text className="text-sf-muted text-xs">{demanda.categoriaNome}</Text>
      </View>
      <Text className="text-sf-body text-sm mt-0.5" numberOfLines={2}>{demanda.descricao}</Text>
      <View className="flex-row justify-between mt-1">
        <Text className="text-sf-muted text-xs">
          {[demanda.enderecoBairro, demanda.enderecoCidade].filter(Boolean).join(", ")}
        </Text>
        {demanda.orcamentoMaximo != null ? (
          <Text className="text-sf-muted text-xs">até R$ {demanda.orcamentoMaximo}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
