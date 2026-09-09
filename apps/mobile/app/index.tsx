import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const carregando = useAuthStore((s) => s.carregando);
  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={session ? "/(app)/(tabs)" : "/(auth)/login"} />;
}
