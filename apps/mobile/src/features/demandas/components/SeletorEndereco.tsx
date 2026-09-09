import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMeusEnderecos } from "@/features/enderecos/hooks/useMeusEnderecos";
import { useCriarEndereco } from "@/features/enderecos/hooks/useCriarEndereco";
import { FormEndereco } from "@/features/enderecos/components/FormEndereco";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function SeletorEndereco({
  enderecoSelecionado,
  onSelecionar,
}: {
  enderecoSelecionado: Endereco | null;
  onSelecionar: (e: Endereco) => void;
}) {
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const lista = useMeusEnderecos();
  const criar = useCriarEndereco();

  if (lista.isLoading) return <CarregandoEstado />;

  return (
    <View className="gap-2">
      {(lista.data ?? []).map((e) => {
        const selecionado = e.id === enderecoSelecionado?.id;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => onSelecionar(e)}
            className={`border rounded-lg px-3 py-2 ${selecionado ? "border-sf-primary bg-sf-surface-variant" : "border-sf-outline"}`}
          >
            <Text className="text-sf-text">{e.identificacao ?? e.cidade ?? "Endereço"}</Text>
            <Text className="text-sf-muted text-xs">
              {[e.logradouro, e.numero, e.bairro, e.cidade].filter(Boolean).join(", ")}
            </Text>
          </Pressable>
        );
      })}

      {mostrandoForm ? (
        <FormEndereco
          enviando={criar.isPending}
          onCriar={async (dados) => {
            const novo = await criar.mutateAsync(dados);
            setMostrandoForm(false);
            onSelecionar(novo);
          }}
        />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setMostrandoForm(true)} className="py-2">
          <Text className="text-sf-primary">+ Adicionar endereço</Text>
        </Pressable>
      )}
    </View>
  );
}
