import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useCompletarPerfil } from "../hooks/useCompletarPerfil";
import { Botao } from "@/shared/components/atoms/Botao";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";

export function CompletarPerfilScreen() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const m = useCompletarPerfil();
  const ok = nome.trim() && telefone.trim() && cidade.trim() && !m.isPending;

  useEffect(() => {
    if (m.isSuccess) {
      router.replace("/(app)/(tabs)");
    }
  }, [m.isSuccess]);

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-1">Complete seu perfil</Text>
      <Text className="text-sf-body mb-2">Falta pouco para começar.</Text>
      <CampoTexto placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <CampoTexto placeholder="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />
      <CampoTexto placeholder="Cidade" value={cidade} onChangeText={setCidade} />
      {m.isError ? <Text className="text-sf-status-red">{(m.error as Error).message}</Text> : null}
      <Botao
        titulo="Salvar"
        onPress={() => m.mutate({ nome, telefone, cidade })}
        carregando={m.isPending}
        desabilitado={!ok}
      />
    </View>
  );
}
