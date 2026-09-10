import { View } from "react-native";
import { router } from "expo-router";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { Botao } from "@/shared/components/atoms/Botao";
import { Texto } from "@/shared/components/atoms/Texto";

export function InicioScreen() {
  const modo = useUiModeStore((s) => s.modo);
  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Texto variante="titulo">
        {modo === "prestar" ? "Encontre trabalho" : "O que você precisa hoje?"}
      </Texto>
      {modo === "prestar" ? (
        <Botao titulo="Ver vagas" onPress={() => router.push("/(app)/(tabs)/vagas")} />
      ) : (
        <View className="gap-2">
          <Botao titulo="Criar demanda" onPress={() => router.push("/(app)/criar-demanda")} />
          <Botao
            titulo="Buscar serviços"
            variante="secundario"
            onPress={() => router.push("/(app)/(tabs)/buscar")}
          />
        </View>
      )}
    </View>
  );
}
