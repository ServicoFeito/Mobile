import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useSignUp } from "../hooks/useSignUp";

export function RegistrarScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const signUp = useSignUp();
  const podeEnviar =
    email.includes("@") && senha.length >= 6 && senha === confirmar && !signUp.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Criar conta</Text>
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
        placeholder="Confirmar senha"
        secureTextEntry
        value={confirmar}
        onChangeText={setConfirmar}
      />
      {signUp.isError ? (
        <Text className="text-sf-status-red">{(signUp.error as Error).message}</Text>
      ) : null}
      {signUp.isSuccess ? (
        <Text className="text-sf-body">Verifique seu e-mail para confirmar.</Text>
      ) : null}
      <Pressable
        disabled={!podeEnviar}
        onPress={() => signUp.mutate({ email, senha })}
        className={`rounded-lg py-3 items-center ${podeEnviar ? "bg-sf-primary" : "bg-sf-muted"}`}
      >
        {signUp.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Criar conta</Text>}
      </Pressable>
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/login" className="text-sf-primary">Já tenho conta</Link>
      </View>
    </View>
  );
}
