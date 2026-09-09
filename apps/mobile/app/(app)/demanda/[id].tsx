import { useLocalSearchParams } from "expo-router";
import { DemandaDetalheScreen } from "@/features/demandas/screens/DemandaDetalheScreen";

export default function DemandaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DemandaDetalheScreen id={id ?? ""} />;
}
