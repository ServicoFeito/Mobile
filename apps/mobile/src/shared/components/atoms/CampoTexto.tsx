import { View, Text, TextInput, type TextInputProps } from "react-native";

export function CampoTexto({ erro, ...props }: TextInputProps & { erro?: string }) {
  return (
    <View>
      <TextInput
        placeholderTextColor="#9E9E9E"
        {...props}
        className="bg-sf-surface border border-sf-outline rounded-lg px-4 py-3 text-sf-text"
      />
      {erro ? <Text className="text-sf-status-red mt-1">{erro}</Text> : null}
    </View>
  );
}
