import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/shared/store/authStore";

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  if (session) return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
