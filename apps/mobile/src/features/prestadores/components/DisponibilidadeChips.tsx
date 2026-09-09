import { Text, View } from "react-native";
import type { DisponibilidadeSemana } from "@/features/prestadores/types/prestador.types";

const DIAS: { chave: keyof DisponibilidadeSemana; rotulo: string }[] = [
  { chave: "seg", rotulo: "Seg" },
  { chave: "ter", rotulo: "Ter" },
  { chave: "qua", rotulo: "Qua" },
  { chave: "qui", rotulo: "Qui" },
  { chave: "sex", rotulo: "Sex" },
  { chave: "sab", rotulo: "Sáb" },
  { chave: "dom", rotulo: "Dom" },
];

export function DisponibilidadeChips({ disponibilidade }: { disponibilidade: DisponibilidadeSemana }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {DIAS.map(({ chave, rotulo }) => (
        <View
          key={chave}
          className={`px-2 py-1 rounded-full border ${
            disponibilidade[chave] ? "bg-sf-surface-variant border-sf-primary" : "border-sf-outline"
          }`}
        >
          <Text className={disponibilidade[chave] ? "text-sf-dark-green text-xs" : "text-sf-muted text-xs"}>
            {rotulo}
          </Text>
        </View>
      ))}
    </View>
  );
}
