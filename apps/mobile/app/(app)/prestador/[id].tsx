import { useLocalSearchParams } from "expo-router";
import { PrestadorPerfilScreen } from "@/features/prestadores/screens/PrestadorPerfilScreen";

export default function PrestadorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrestadorPerfilScreen usuarioId={id ?? ""} />;
}
