import "../global.css";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/shared/query/queryClient";
import { assertEnvSupabase } from "@/shared/api/supabaseClient";
import { useAuthStore } from "@/shared/store/authStore";
import { useUiModeStore } from "@/shared/store/uiModeStore";

export default function RootLayout() {
  const carregando = useAuthStore((s) => s.carregando);

  useEffect(() => {
    assertEnvSupabase();
    useAuthStore.getState().hidratar();
    useUiModeStore.getState().carregar();
    const parar = useAuthStore.getState().iniciarListenerAuth();
    return parar;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {carregando ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
