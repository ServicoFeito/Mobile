import { useLocalSearchParams } from "expo-router";
import { PrestadoresPorCategoriaScreen } from "@/features/descoberta/screens/PrestadoresPorCategoriaScreen";

export default function CategoriaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrestadoresPorCategoriaScreen categoriaId={id ?? ""} />;
}
