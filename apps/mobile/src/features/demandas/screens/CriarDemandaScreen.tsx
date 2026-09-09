import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { Botao } from "@/shared/components/atoms/Botao";
import { SeletorCategoria } from "@/features/demandas/components/SeletorCategoria";
import { SeletorEndereco } from "@/features/demandas/components/SeletorEndereco";
import { useCriarDemanda } from "@/features/demandas/hooks/useCriarDemanda";
import { formatarEndereco } from "@/features/enderecos/types/endereco.types";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function CriarDemandaScreen() {
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [endereco, setEndereco] = useState<Endereco | null>(null);
  const criar = useCriarDemanda();

  useEffect(() => {
    if (criar.isSuccess && criar.data) router.replace(`/(app)/demanda/${criar.data.id}`);
  }, [criar.isSuccess, criar.data]);

  const ok =
    !!categoriaId && titulo.trim().length > 0 && descricao.trim().length > 0 && !!endereco && !criar.isPending;

  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-sf-text font-semibold mb-1">Categoria</Text>
      <SeletorCategoria categoriaId={categoriaId} onSelecionar={setCategoriaId} />

      <View className="gap-2 mt-3">
        <CampoTexto placeholder="Título (ex: Pintar a sala)" value={titulo} onChangeText={setTitulo} />
        <CampoTexto
          placeholder="Descreva o que precisa"
          value={descricao}
          onChangeText={setDescricao}
          multiline
        />
        <CampoTexto
          placeholder="Orçamento máximo (opcional)"
          value={orcamento}
          onChangeText={setOrcamento}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <Text className="text-sf-text font-semibold mt-4 mb-1">Endereço</Text>
      <SeletorEndereco enderecoSelecionado={endereco} onSelecionar={setEndereco} />

      {criar.isError ? (
        <Text className="text-sf-status-red mt-3">{traduzErroRepo(criar.error)}</Text>
      ) : null}

      <View className="mt-4 mb-10">
        <Botao
          titulo="Publicar demanda"
          desabilitado={!ok}
          carregando={criar.isPending}
          onPress={() => {
            if (!ok || !endereco || !categoriaId) return;
            const orc = Number.parseFloat(orcamento.replace(",", "."));
            criar.mutate({
              categoriaId,
              titulo: titulo.trim(),
              descricao: descricao.trim(),
              orcamentoMaximo: Number.isFinite(orc) && orc > 0 ? orc : null,
              urgencia: "Normal",
              enderecoCidade: endereco.cidade,
              enderecoBairro: endereco.bairro,
              enderecoCompleto: formatarEndereco(endereco),
              dataDesejada: null,
            });
          }}
        />
      </View>
    </ScrollView>
  );
}
