import { ScrollView, Text, Pressable } from "react-native";
import { useCategorias } from "@/features/descoberta/hooks/useCategorias";

export function SeletorCategoria({
  categoriaId,
  onSelecionar,
}: {
  categoriaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const cats = useCategorias();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {(cats.data ?? []).map((c) => {
        const sel = c.id === categoriaId;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => onSelecionar(c.id)}
            className={`px-3 py-1.5 mx-1 rounded-full border ${sel ? "bg-sf-primary border-sf-primary" : "border-sf-outline"}`}
          >
            <Text className={sel ? "text-white text-sm" : "text-sf-body text-sm"}>{c.nome}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
