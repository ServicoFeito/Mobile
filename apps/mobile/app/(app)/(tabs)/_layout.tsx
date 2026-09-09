import { Tabs } from "expo-router";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { cores } from "@/shared/theme/tokens";

export default function TabsLayout() {
  const modo = useUiModeStore((s) => s.modo);
  const prestar = modo === "prestar";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: prestar ? cores.darkGreen : cores.primary,
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="buscar" options={{ title: "Buscar", href: prestar ? null : "/(app)/(tabs)/buscar" }} />
      <Tabs.Screen name="vagas" options={{ title: "Vagas", href: prestar ? "/(app)/(tabs)/vagas" : null }} />
      <Tabs.Screen name="trabalhos" options={{ title: "Trabalhos", href: prestar ? "/(app)/(tabs)/trabalhos" : null }} />
      <Tabs.Screen name="conversas" options={{ title: "Mensagens" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
