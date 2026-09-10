import { Pressable, Text, View } from "react-native";
import type { Conversa } from "@/features/conversas/types/conversa.types";

function horaCurta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ConversaRow({ conversa, onPress }: { conversa: Conversa; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-row justify-between">
        <Text className="text-sf-text font-semibold" numberOfLines={1}>
          {conversa.outroNome ?? "Usuário"}
        </Text>
        <Text className="text-sf-muted text-xs">{horaCurta(conversa.dataUltimaMensagem)}</Text>
      </View>
      <View className="flex-row justify-between items-center mt-0.5">
        <Text className="text-sf-body text-sm flex-1" numberOfLines={1}>
          {conversa.ultimaMensagem ?? ""}
        </Text>
        {conversa.naoLidas > 0 ? (
          <View className="bg-sf-primary rounded-full min-w-5 px-1.5 py-0.5 ml-2 items-center">
            <Text className="text-white text-xs">{conversa.naoLidas}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
