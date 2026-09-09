// Espelho JS dos tokens de cor (mesmas chaves de tailwind.config.js > theme.extend.colors.sf).
// Uso: quando um valor de cor precisa ir para uma prop RN nativa (ex.: statusBarColor,
// tabBarActiveTintColor) e não dá para usar className.
export const cores = {
  primary: "#4DAF50",
  secondary: "#70D173",
  tint: "#CBE8CC",
  darkGreen: "#2E7D32",
  text: "#333333",
  body: "#6B6B6B",
  muted: "#9E9E9E",
  favorite: "#E02957",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F8F1",
  outline: "#E0E0E0",
  statusYellow: "#FFA000",
  statusBlue: "#1976D2",
  statusGreen: "#388E3C",
  statusRed: "#D32F2F",
} as const;

export type CorSF = keyof typeof cores;
