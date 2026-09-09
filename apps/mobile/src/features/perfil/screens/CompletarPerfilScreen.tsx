import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useCompletarPerfil } from "../hooks/useCompletarPerfil";

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
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Telefone" keyboardType="phone-pad" value={telefone} onChangeText={setTelefone} />
      <TextInput className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text" placeholder="Cidade" value={cidade} onChangeText={setCidade} />
      {m.isError ? <Text className="text-sf-status-red">{(m.error as Error).message}</Text> : null}
      <Pressable disabled={!ok} onPress={() => m.mutate({ nome, telefone, cidade })} className={`rounded-lg py-3 items-center ${ok ? "bg-sf-primary" : "bg-sf-muted"}`}>
        {m.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Salvar</Text>}
      </Pressable>
    </View>
  );
}
