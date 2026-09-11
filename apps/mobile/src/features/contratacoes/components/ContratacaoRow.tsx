import { Pressable, Text, View } from "react-native";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";
import { statusContratacaoLabel } from "@/features/contratacoes/lib/statusContratacaoLabel";
import { formatarBRL } from "@/shared/lib/formatarBRL";

export function ContratacaoRow({
  contratacao,
  onPress,
}: {
  contratacao: Contratacao;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <Text className="text-sf-muted text-xs">{statusContratacaoLabel(contratacao.status)}</Text>
      <Text className="text-sf-text font-semibold mt-0.5" numberOfLines={1}>
        {contratacao.tituloServico}
      </Text>
      <View className="flex-row justify-between items-center mt-0.5">
        <Text className="text-sf-body text-sm flex-1" numberOfLines={1}>
          {contratacao.outroNome ?? "Usuário"}
        </Text>
        <Text className="text-sf-text text-sm font-semibold ml-2">
          {formatarBRL(contratacao.valorTotal)}
        </Text>
      </View>
    </Pressable>
  );
}
