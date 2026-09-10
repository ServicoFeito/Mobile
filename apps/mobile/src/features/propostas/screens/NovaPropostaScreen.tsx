import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import { useConversa } from "@/features/conversas/hooks/useConversa";
import { useCriarProposta } from "@/features/propostas/hooks/useCriarProposta";

export function NovaPropostaScreen({ id }: { id: string }) {
  const q = useConversa(id);
  const criar = useCriarProposta();

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazoExecucao, setPrazoExecucao] = useState("");
  const [validadeDias, setValidadeDias] = useState("7");

  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError || !q.data)
    return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const conversa = q.data;
  const valorNum = Number(valor);
  const podeEnviar = valorNum > 0 && descricao.trim() !== "";

  function enviar() {
    if (!podeEnviar) return;
    criar.mutate(
      {
        conversaId: id,
        demandaId: conversa.demandaId,
        clienteId: conversa.clienteId,
        valor: valorNum,
        descricao: descricao.trim(),
        prazoExecucao: prazoExecucao.trim() || null,
        validadeDias: Number(validadeDias) || 7,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <View className="gap-2">
        <CampoTexto
          placeholder="Valor (R$)"
          value={valor}
          onChangeText={setValor}
          keyboardType="numeric"
        />
        <CampoTexto
          placeholder="Descreva o serviço"
          value={descricao}
          onChangeText={setDescricao}
          multiline
        />
        <CampoTexto
          placeholder="Prazo de execução (ex.: 3 dias)"
          value={prazoExecucao}
          onChangeText={setPrazoExecucao}
        />
        <CampoTexto
          placeholder="Validade (dias)"
          value={validadeDias}
          onChangeText={setValidadeDias}
          keyboardType="numeric"
        />
      </View>

      <View className="mt-4 mb-10">
        <Botao
          titulo="Enviar proposta"
          desabilitado={!podeEnviar || criar.isPending}
          carregando={criar.isPending}
          onPress={enviar}
        />
        {criar.error ? (
          <Text className="text-sf-status-red mt-3">{traduzErroRepo(criar.error)}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
