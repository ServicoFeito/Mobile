import { useLocalSearchParams } from "expo-router";
import { NovaPropostaScreen } from "@/features/propostas/screens/NovaPropostaScreen";

export default function NovaPropostaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NovaPropostaScreen id={id ?? ""} />;
}
