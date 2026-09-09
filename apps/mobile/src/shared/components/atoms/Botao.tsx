import { Pressable, Text, ActivityIndicator } from "react-native";

type Variante = "primario" | "perigo" | "secundario";

const fundo: Record<Variante, string> = {
  primario: "bg-sf-primary",
  perigo: "bg-sf-status-red",
  secundario: "bg-sf-surface-variant",
};
const textoCor: Record<Variante, string> = {
  primario: "text-white",
  perigo: "text-white",
  secundario: "text-sf-dark-green",
};

export function Botao({
  titulo,
  onPress,
  carregando = false,
  desabilitado = false,
  variante = "primario",
}: {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: Variante;
}) {
  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inativo}
      onPress={onPress}
      className={`rounded-lg py-3 items-center ${inativo ? "bg-sf-muted" : fundo[variante]}`}
    >
      {carregando ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className={`font-semibold ${textoCor[variante]}`}>{titulo}</Text>
      )}
    </Pressable>
  );
}
