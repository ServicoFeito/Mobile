import { Pressable, Text, View } from "react-native";
import type { Tarefa } from "@/features/tarefas/types/tarefa.types";

export function TarefaRow({
  tarefa,
  interativo,
  onToggle,
}: {
  tarefa: Tarefa;
  interativo: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: tarefa.concluida, disabled: !interativo }}
      onPress={interativo ? onToggle : undefined}
      className={`flex-row items-center px-4 py-3 mb-2 ${interativo ? "" : "opacity-50"}`}
    >
      <View
        className={`w-5 h-5 rounded border border-sf-outline items-center justify-center mr-3 ${
          tarefa.concluida ? "bg-sf-primary border-sf-primary" : "bg-sf-surface"
        }`}
      >
        {tarefa.concluida ? <Text className="text-white text-xs">✓</Text> : null}
      </View>
      <Text
        className={`text-sf-text text-sm flex-1 ${
          tarefa.concluida ? "line-through text-sf-muted" : ""
        }`}
      >
        {tarefa.nomeTarefa}
      </Text>
    </Pressable>
  );
}
