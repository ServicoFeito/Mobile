import { render, fireEvent } from "@testing-library/react-native";
import type { Proposta } from "@/features/propostas/types/proposta.types";
import { PropostaCard } from "./PropostaCard";

const mk = (over?: Partial<Proposta>): Proposta => ({
  id: "p1",
  demandaId: "d1",
  conversaId: "a1",
  prestadorId: "u2",
  clienteId: "u1",
  valor: 300,
  taxaPlataforma: 60,
  valorLiquidoPrestador: 240,
  descricao: "Pintura completa",
  prazoExecucao: "3 dias",
  validadeDias: 7,
  status: "ENVIADA",
  createdAt: "2026-03-01T00:00:00Z",
  ...over,
});

it("cliente + ENVIADA: mostra Aceitar/Recusar e dispara os callbacks", () => {
  const onAceitar = jest.fn();
  const onRecusar = jest.fn();
  const { getByText } = render(
    <PropostaCard
      proposta={mk()}
      souCliente
      onAceitar={onAceitar}
      onRecusar={onRecusar}
    />,
  );
  expect(getByText("R$ 300.00")).toBeTruthy();
  expect(getByText("Pintura completa")).toBeTruthy();
  fireEvent.press(getByText("Aceitar"));
  expect(onAceitar).toHaveBeenCalledTimes(1);
  fireEvent.press(getByText("Recusar"));
  expect(onRecusar).toHaveBeenCalledTimes(1);
});

it("prestador (souCliente=false): sem botões, mas mostra o status", () => {
  const { queryByText, getByText } = render(
    <PropostaCard
      proposta={mk()}
      souCliente={false}
      onAceitar={jest.fn()}
      onRecusar={jest.fn()}
    />,
  );
  expect(queryByText("Aceitar")).toBeNull();
  expect(getByText("ENVIADA")).toBeTruthy();
});

it("cliente + ACEITA: sem botões (só status pendente recebe ações)", () => {
  const { queryByText } = render(
    <PropostaCard
      proposta={mk({ status: "ACEITA" })}
      souCliente
      onAceitar={jest.fn()}
      onRecusar={jest.fn()}
    />,
  );
  expect(queryByText("Aceitar")).toBeNull();
});

it("renderiza a mensagem de erro quando erro é uma string", () => {
  const { getByText } = render(
    <PropostaCard
      proposta={mk()}
      souCliente
      onAceitar={jest.fn()}
      onRecusar={jest.fn()}
      erro="Esta proposta não está mais disponível."
    />,
  );
  expect(getByText("Esta proposta não está mais disponível.")).toBeTruthy();
});

it("ocupado bloqueia o press em Aceitar", () => {
  const onAceitar = jest.fn();
  const { getByText } = render(
    <PropostaCard
      proposta={mk()}
      souCliente
      onAceitar={onAceitar}
      onRecusar={jest.fn()}
      ocupado
    />,
  );
  fireEvent.press(getByText("Aceitar"));
  expect(onAceitar).not.toHaveBeenCalled();
});
