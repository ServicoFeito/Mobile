import { useLocalSearchParams } from "expo-router";
import { ConversaScreen } from "@/features/conversas/screens/ConversaScreen";

export default function ConversaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversaScreen id={id ?? ""} />;
}
