import { useState } from "react";
import { View } from "react-native";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { Botao } from "@/shared/components/atoms/Botao";
import type { DadosNovoEndereco } from "@/features/enderecos/hooks/useCriarEndereco";

export function FormEndereco({
  onCriar,
  enviando,
}: {
  onCriar: (dados: DadosNovoEndereco) => void;
  enviando: boolean;
}) {
  const [identificacao, setIdentificacao] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const ok = cidade.trim().length > 0 && !enviando;

  return (
    <View className="gap-2 mt-2">
      <CampoTexto placeholder="Identificação (ex: Casa)" value={identificacao} onChangeText={setIdentificacao} />
      <CampoTexto placeholder="Cidade *" value={cidade} onChangeText={setCidade} autoCapitalize="words" />
      <CampoTexto placeholder="Bairro" value={bairro} onChangeText={setBairro} />
      <CampoTexto placeholder="Logradouro" value={logradouro} onChangeText={setLogradouro} />
      <CampoTexto placeholder="Número" value={numero} onChangeText={setNumero} keyboardType="numbers-and-punctuation" />
      <CampoTexto placeholder="Complemento" value={complemento} onChangeText={setComplemento} />
      <Botao
        titulo="Salvar endereço"
        desabilitado={!ok}
        carregando={enviando}
        onPress={() =>
          onCriar({
            identificacao: identificacao.trim() || null,
            cep: null,
            estado: null,
            cidade: cidade.trim(),
            bairro: bairro.trim() || null,
            logradouro: logradouro.trim() || null,
            numero: numero.trim() || null,
            complemento: complemento.trim() || null,
            principal: false,
          })
        }
      />
    </View>
  );
}
