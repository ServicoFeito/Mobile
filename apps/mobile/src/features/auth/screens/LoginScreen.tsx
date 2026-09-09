import { useState } from "react";
import { View, Text } from "react-native";
import { Link } from "expo-router";
import { useSignIn } from "../hooks/useSignIn";
import { Botao } from "@/shared/components/atoms/Botao";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const signIn = useSignIn();
  const podeEnviar = email.includes("@") && senha.length >= 6 && !signIn.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Entrar</Text>
      <CampoTexto
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <CampoTexto
        placeholder="Senha"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />
      {signIn.isError ? (
        <Text className="text-sf-status-red">{(signIn.error as Error).message}</Text>
      ) : null}
      <Botao
        titulo="Entrar"
        onPress={() => signIn.mutate({ email, senha })}
        carregando={signIn.isPending}
        desabilitado={!podeEnviar}
      />
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/registrar" className="text-sf-primary">Criar conta</Link>
        <Link href="/(auth)/redefinir-senha" className="text-sf-body">Esqueci a senha</Link>
      </View>
    </View>
  );
}
