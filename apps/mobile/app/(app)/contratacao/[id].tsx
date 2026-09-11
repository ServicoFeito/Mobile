import { useLocalSearchParams } from "expo-router";
import { ContratacaoScreen } from "@/features/contratacoes/screens/ContratacaoScreen";

export default function ContratacaoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContratacaoScreen id={id ?? ""} />;
}
