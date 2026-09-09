import { useState } from "react";
import { View, Text } from "react-native";
import { Link } from "expo-router";
import { useResetPassword } from "../hooks/useResetPassword";
import { Botao } from "@/shared/components/atoms/Botao";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";

export function RedefinirSenhaScreen() {
  const [email, setEmail] = useState("");
  const reset = useResetPassword();
  const podeEnviar = email.includes("@") && !reset.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Redefinir senha</Text>
      <CampoTexto
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {reset.isError ? (
        <Text className="text-sf-status-red">{(reset.error as Error).message}</Text>
      ) : null}
      {reset.isSuccess ? (
        <Text className="text-sf-body">Enviamos um link para seu e-mail.</Text>
      ) : null}
      <Botao
        titulo="Enviar link"
        onPress={() => reset.mutate(email)}
        carregando={reset.isPending}
        desabilitado={!podeEnviar}
      />
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/login" className="text-sf-primary">Voltar ao login</Link>
      </View>
    </View>
  );
}
