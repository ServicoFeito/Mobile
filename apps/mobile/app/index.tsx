import { Redirect } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const carregando = useAuthStore((s) => s.carregando);
  if (carregando) {
    return <CarregandoEstado />;
  }
  return <Redirect href={session ? "/(app)/(tabs)" : "/(auth)/login"} />;
}
