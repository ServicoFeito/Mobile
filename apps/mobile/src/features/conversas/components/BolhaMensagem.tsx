import { Text, View } from "react-native";
import type { Mensagem } from "@/features/conversas/types/conversa.types";

export function BolhaMensagem({ mensagem, meuId }: { mensagem: Mensagem; meuId: string }) {
  const minha = mensagem.remetenteId === meuId;
  return (
    <View className={`w-full mb-1.5 ${minha ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          minha ? "bg-sf-primary" : "bg-sf-surface-variant"
        }`}
      >
        <Text className={minha ? "text-white" : "text-sf-text"}>{mensagem.corpo}</Text>
      </View>
    </View>
  );
}
