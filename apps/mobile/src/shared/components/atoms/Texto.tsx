import { Text, type TextProps } from "react-native";

const classePorVariante = {
  titulo: "text-2xl font-bold text-sf-text",
  corpo: "text-sf-body",
  muted: "text-sf-muted",
} as const;

export function Texto({ variante = "corpo", ...props }: TextProps & { variante?: "titulo" | "corpo" | "muted" }) {
  return <Text {...props} className={classePorVariante[variante]} />;
}
