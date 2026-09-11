import { ActivityIndicator } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";

jest.mock("@/features/contratacoes/hooks/useMinhasContratacoes", () => ({
  useMinhasContratacoes: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { useMinhasContratacoes } from "@/features/contratacoes/hooks/useMinhasContratacoes";
import { router } from "expo-router";
import { TrabalhosScreen } from "./TrabalhosScreen";

const mockUseMinhasContratacoes = useMinhasContratacoes as jest.Mock;

const contratacaoBase: Contratacao = {
  id: "ct1",
  demandaId: "d1",
  propostaId: "p1",
  tituloServico: "Pintura de parede",
  clienteId: "c1",
  prestadorId: "pr1",
  valorTotal: 300,
  valorEntrada: null,
  valorFinal: null,
  taxaPlataforma: 60,
  status: "AGUARDANDO_PAGAMENTO",
  entradaPaga: false,
  finalPago: false,
  avaliado: false,
  dataAgendada: null,
  dataConclusao: null,
  outroId: "pr1",
  outroNome: "Bia",
  outroFotoUrl: null,
  createdAt: "2026-03-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("estado de carregando", () => {
  mockUseMinhasContratacoes.mockReturnValue({ isLoading: true });
  const { UNSAFE_getByType, queryByText } = render(<TrabalhosScreen />);
  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(queryByText("Nenhuma contratação ainda.")).toBeNull();
});

it("estado vazio", () => {
  mockUseMinhasContratacoes.mockReturnValue({ isLoading: false, isError: false, data: [] });
  const { getByText } = render(<TrabalhosScreen />);
  expect(getByText("Nenhuma contratação ainda.")).toBeTruthy();
});

it("estado de erro com retry", () => {
  const refetch = jest.fn();
  mockUseMinhasContratacoes.mockReturnValue({
    isLoading: false,
    isError: true,
    error: new Error("falhou"),
    data: undefined,
    refetch,
  });
  const { getByText } = render(<TrabalhosScreen />);
  fireEvent.press(getByText("Tentar de novo"));
  expect(refetch).toHaveBeenCalled();
});

it("lista contratacoes e navega ao tocar usando propostaId, nao id", () => {
  mockUseMinhasContratacoes.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [contratacaoBase],
  });
  const { getByText } = render(<TrabalhosScreen />);
  expect(getByText("Pintura de parede")).toBeTruthy();
  fireEvent.press(getByText("Pintura de parede"));
  expect(router.push).toHaveBeenCalledWith("/contratacao/p1");
});
