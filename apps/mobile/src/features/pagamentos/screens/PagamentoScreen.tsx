import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { RepoError } from "@/shared/api/repositories";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { usePagamentoPendente } from "@/features/pagamentos/hooks/usePagamentoPendente";
import { useCriarCobranca } from "@/features/pagamentos/hooks/useCriarCobranca";
import { usePagamentoStatus } from "@/features/pagamentos/hooks/usePagamentoStatus";

const ERRO_PAGAMENTO_GENERICO = "Não foi possível concluir. Tente de novo.";

export function erroPagamento(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof RepoError) {
    return ERRO_PAGAMENTO_GENERICO;
  }
  return ERRO_PAGAMENTO_GENERICO;
}

export function PagamentoScreen({ contratacaoId }: { contratacaoId: string }) {
  const pendenteQ = usePagamentoPendente(contratacaoId);
  const criarCobranca = useCriarCobranca();
  const disparado = useRef(false);
  const [copiado, setCopiado] = useState(false);

  const pagamentoIdInicial = pendenteQ.data?.id ?? null;
  const statusQ = usePagamentoStatus(pagamentoIdInicial);

  useEffect(() => {
    if (disparado.current) return;
    if (pendenteQ.data && pendenteQ.data.status === "PENDENTE") {
      disparado.current = true;
      criarCobranca.mutate(pendenteQ.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendenteQ.data]);

  if (pendenteQ.isLoading) return <CarregandoEstado />;

  if (!pendenteQ.data) {
    return (
      <View className="flex-1 bg-sf-bg items-center justify-center px-6">
        <Text className="text-sf-text text-base mb-4">Nada pendente pra pagar.</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const pagamento = statusQ.data ?? pendenteQ.data;

  if (pagamento.status === "PAGO") {
    return (
      <View className="flex-1 bg-sf-bg items-center justify-center px-6">
        <Text className="text-sf-text text-xl font-bold mb-2">Pagamento confirmado!</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  async function copiarCodigo() {
    if (!pagamento.pixCopiaCola) return;
    await Clipboard.setStringAsync(pagamento.pixCopiaCola);
    setCopiado(true);
  }

  return (
    <View className="flex-1 bg-sf-bg px-6 pt-10 items-center">
      <Text className="text-sf-text text-lg font-semibold mb-4">
        {pendenteQ.data.tipo === "ENTRADA" ? "Pagamento de entrada" : "Pagamento final"}
      </Text>

      {criarCobranca.isPending || (!pagamento.qrCodeBase64 && statusQ.isLoading) ? (
        <ActivityIndicator />
      ) : pagamento.qrCodeBase64 ? (
        <>
          <Image
            testID="pagamento-qr"
            source={{ uri: pagamento.qrCodeBase64 }}
            className="w-64 h-64 mb-4"
          />
          <Text selectable className="text-sf-body text-xs text-center mb-4 px-2">
            {pagamento.pixCopiaCola}
          </Text>
          <Botao
            titulo={copiado ? "Copiado!" : "Copiar código"}
            variante="secundario"
            onPress={copiarCodigo}
          />
        </>
      ) : null}

      {erroPagamento(criarCobranca.error) ? (
        <View className="mt-4 items-center">
          <Text className="text-sf-status-red mb-2">{erroPagamento(criarCobranca.error)}</Text>
          <Botao
            titulo="Tentar de novo"
            onPress={() => {
              disparado.current = false;
              criarCobranca.mutate(pendenteQ.data!.id);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
