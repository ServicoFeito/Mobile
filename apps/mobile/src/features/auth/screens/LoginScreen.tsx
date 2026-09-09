import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useSignIn } from "../hooks/useSignIn";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const signIn = useSignIn();
  const podeEnviar = email.includes("@") && senha.length >= 6 && !signIn.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Entrar</Text>
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
      {signIn.isError ? (
        <Text className="text-sf-status-red">{(signIn.error as Error).message}</Text>
      ) : null}
      <Pressable
        disabled={!podeEnviar}
        onPress={() => signIn.mutate({ email, senha })}
        className={`rounded-lg py-3 items-center ${podeEnviar ? "bg-sf-primary" : "bg-sf-muted"}`}
      >
        {signIn.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Entrar</Text>}
      </Pressable>
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/registrar" className="text-sf-primary">Criar conta</Link>
        <Link href="/(auth)/redefinir-senha" className="text-sf-body">Esqueci a senha</Link>
      </View>
    </View>
  );
}
