import { render, fireEvent } from "@testing-library/react-native";
import type { Conversa } from "@/features/conversas/types/conversa.types";

jest.mock("@/features/conversas/hooks/useConversa", () => ({ useConversa: jest.fn() }));
jest.mock("@/features/propostas/hooks/useCriarProposta", () => ({ useCriarProposta: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

import { router } from "expo-router";
import { useConversa } from "@/features/conversas/hooks/useConversa";
import { useCriarProposta } from "@/features/propostas/hooks/useCriarProposta";
import { RepoError } from "@/shared/api/repositories";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import { NovaPropostaScreen } from "./NovaPropostaScreen";

const conversaFake: Conversa = {
  id: "a1",
  tipo: "DEMANDA",
  demandaId: "d1",
  clienteId: "u1",
  prestadorId: "u2",
  status: "ativa",
  ultimaMensagem: null,
  dataUltimaMensagem: null,
  naoLidas: 0,
  outroId: "u1",
  outroNome: "Cliente",
  outroFotoUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
};

function mockConversa(over: Record<string, unknown> = {}) {
  (useConversa as jest.Mock).mockReturnValue({
    isLoading: false,
    isError: false,
    data: conversaFake,
    error: null,
    refetch: jest.fn(),
    ...over,
  });
}

function mockCriar(over: Record<string, unknown> = {}) {
  const mutate = jest.fn();
  (useCriarProposta as jest.Mock).mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    ...over,
  });
  return mutate;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("sem valor/descrição o botão não dispara a mutation", () => {
  mockConversa();
  const mutate = mockCriar();
  const { getByText } = render(<NovaPropostaScreen id="a1" />);

  fireEvent.press(getByText("Enviar proposta"));

  expect(mutate).not.toHaveBeenCalled();
});

it("preenchendo valor e descrição envia a proposta e volta no onSuccess", () => {
  mockConversa();
  const mutate = mockCriar();
  const { getByText, getByPlaceholderText } = render(<NovaPropostaScreen id="a1" />);

  fireEvent.changeText(getByPlaceholderText("Valor (R$)"), "300");
  fireEvent.changeText(getByPlaceholderText("Descreva o serviço"), "Pintura completa");
  fireEvent.press(getByText("Enviar proposta"));

  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      conversaId: "a1",
      demandaId: "d1",
      clienteId: "u1",
      valor: 300,
      descricao: "Pintura completa",
      validadeDias: 7,
    }),
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );

  mutate.mock.calls[0][1].onSuccess();
  expect(router.back).toHaveBeenCalled();
});

it("erro da mutation é traduzido e exibido", () => {
  mockConversa();
  const erro = new RepoError("conflito", "duplicado");
  mockCriar({ error: erro });
  const { getByText } = render(<NovaPropostaScreen id="a1" />);

  expect(getByText(traduzErroRepo(erro))).toBeTruthy();
});
