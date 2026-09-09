import { Pressable, Text, View } from "react-native";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export function CategoriaCard({ categoria, onPress }: { categoria: Categoria; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <Text className="text-sf-text font-semibold">{categoria.nome}</Text>
      {categoria.descricao ? (
        <Text className="text-sf-body text-sm mt-0.5" numberOfLines={2}>
          {categoria.descricao}
        </Text>
      ) : null}
      <View className="flex-row mt-1">
        <Text className="text-sf-muted text-xs">
          {categoria.precoMedioHora > 0 ? `~ R$ ${categoria.precoMedioHora}/h` : "preço a combinar"}
        </Text>
      </View>
    </Pressable>
  );
}
