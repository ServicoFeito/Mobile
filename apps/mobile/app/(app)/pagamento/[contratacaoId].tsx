import { useLocalSearchParams } from "expo-router";
import { PagamentoScreen } from "@/features/pagamentos/screens/PagamentoScreen";

export default function PagamentoRoute() {
  const { contratacaoId } = useLocalSearchParams<{ contratacaoId: string }>();
  return <PagamentoScreen contratacaoId={contratacaoId} />;
}
