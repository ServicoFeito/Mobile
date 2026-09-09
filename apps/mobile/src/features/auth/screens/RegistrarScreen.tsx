import { useState } from "react";
import { View, Text } from "react-native";
import { Link } from "expo-router";
import { useSignUp } from "../hooks/useSignUp";
import { Botao } from "@/shared/components/atoms/Botao";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";

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
      <CampoTexto
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
      <Botao
        titulo="Criar conta"
        onPress={() => signUp.mutate({ email, senha })}
        carregando={signUp.isPending}
        desabilitado={!podeEnviar}
      />
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/login" className="text-sf-primary">Já tenho conta</Link>
      </View>
    </View>
  );
}
