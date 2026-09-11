import { Text, View } from "react-native";
import { Botao } from "@/shared/components/atoms/Botao";
import { formatarBRL } from "@/shared/lib/formatarBRL";
import type { Proposta } from "@/features/propostas/types/proposta.types";

const STATUS_PENDENTES = ["ENVIADA", "VISUALIZADA"];

export function PropostaCard({
  proposta,
  souCliente,
  onAceitar,
  onRecusar,
  erro,
  ocupado,
}: {
  proposta: Proposta;
  souCliente: boolean;
  onAceitar: () => void;
  onRecusar: () => void;
  erro?: string | null;
  ocupado?: boolean;
}) {
  const prazo = proposta.prazoExecucao ?? "";
  const podeAgir = souCliente && STATUS_PENDENTES.includes(proposta.status);

  return (
    <View className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2">
      <Text className="text-sf-text text-lg font-semibold">{formatarBRL(proposta.valor)}</Text>
      <Text className="text-sf-body text-sm mt-1">{proposta.descricao}</Text>
      {prazo !== "" ? (
        <Text className="text-sf-muted text-xs mt-1">Prazo: {prazo}</Text>
      ) : null}

      <View className="flex-row mt-2">
        <View className="bg-sf-surface-variant rounded-full px-2 py-0.5">
          <Text className="text-sf-dark-green text-xs font-semibold">{proposta.status}</Text>
        </View>
      </View>

      {podeAgir ? (
        <View className="mt-3">
          <Botao
            titulo="Aceitar"
            variante="primario"
            onPress={onAceitar}
            desabilitado={!!ocupado}
          />
          <View className="h-2" />
          <Botao
            titulo="Recusar"
            variante="perigo"
            onPress={onRecusar}
            desabilitado={!!ocupado}
          />
        </View>
      ) : null}

      {erro ? <Text className="text-sf-status-red text-sm mt-2">{erro}</Text> : null}
    </View>
  );
}
