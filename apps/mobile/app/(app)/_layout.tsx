import { Redirect, Stack, usePathname } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { usePerfilAtual } from "@/features/perfil/hooks/usePerfilAtual";

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const { data: perfil } = usePerfilAtual();

  if (!session) return <Redirect href="/(auth)/login" />;
  if (perfil && !perfil.nome && pathname !== "/completar-perfil") {
    return <Redirect href="/(app)/completar-perfil" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
