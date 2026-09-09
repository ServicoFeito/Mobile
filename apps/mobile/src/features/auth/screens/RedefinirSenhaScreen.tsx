import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useResetPassword } from "../hooks/useResetPassword";

export function RedefinirSenhaScreen() {
  const [email, setEmail] = useState("");
  const reset = useResetPassword();
  const podeEnviar = email.includes("@") && !reset.isPending;

  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Text className="text-2xl font-bold text-sf-text mb-2">Redefinir senha</Text>
      <TextInput
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
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
      <Pressable
        disabled={!podeEnviar}
        onPress={() => reset.mutate(email)}
        className={`rounded-lg py-3 items-center ${podeEnviar ? "bg-sf-primary" : "bg-sf-muted"}`}
      >
        {reset.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Enviar link</Text>}
      </Pressable>
      <View className="flex-row justify-between mt-2">
        <Link href="/(auth)/login" className="text-sf-primary">Voltar ao login</Link>
      </View>
    </View>
  );
}
