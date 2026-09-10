import { ActivityIndicator } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import type { Conversa } from "@/features/conversas/types/conversa.types";

jest.mock("@/features/conversas/hooks/useMinhasConversas", () => ({
  useMinhasConversas: jest.fn(),
}));
jest.mock("@/features/conversas/hooks/useConversasRealtime", () => ({
  useConversasRealtime: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { useMinhasConversas } from "@/features/conversas/hooks/useMinhasConversas";
import { useConversasRealtime } from "@/features/conversas/hooks/useConversasRealtime";
import { router } from "expo-router";
import { ConversasListScreen } from "./ConversasListScreen";

const mockUseMinhasConversas = useMinhasConversas as jest.Mock;

const conversaBase: Conversa = {
  id: "a1",
  tipo: "DEMANDA",
  demandaId: "d1",
  clienteId: "c1",
  prestadorId: "p1",
  status: "ATIVA",
  ultimaMensagem: "oi",
  dataUltimaMensagem: "2026-03-03T10:20:00Z",
  naoLidas: 3,
  outroId: "o1",
  outroNome: "Bia",
  outroFotoUrl: null,
  createdAt: "2026-03-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("monta o realtime de conversas", () => {
  mockUseMinhasConversas.mockReturnValue({ isLoading: true });
  render(<ConversasListScreen />);
  expect(useConversasRealtime).toHaveBeenCalled();
});

it("estado de carregando", () => {
  mockUseMinhasConversas.mockReturnValue({ isLoading: true });
  const { UNSAFE_getByType, queryByText } = render(<ConversasListScreen />);
  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(queryByText("Nenhuma conversa ainda.")).toBeNull();
});

it("estado vazio", () => {
  mockUseMinhasConversas.mockReturnValue({ isLoading: false, isError: false, data: [] });
  const { getByText } = render(<ConversasListScreen />);
  expect(getByText("Nenhuma conversa ainda.")).toBeTruthy();
});

it("estado de erro com retry", () => {
  const refetch = jest.fn();
  mockUseMinhasConversas.mockReturnValue({
    isLoading: false,
    isError: true,
    error: new Error("falhou"),
    data: undefined,
    refetch,
  });
  const { getByText } = render(<ConversasListScreen />);
  fireEvent.press(getByText("Tentar de novo"));
  expect(refetch).toHaveBeenCalled();
});

it("lista conversas com badge de nao lidas e navega ao tocar", () => {
  mockUseMinhasConversas.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [{ ...conversaBase, id: "a1", outroNome: "Bia", ultimaMensagem: "oi", naoLidas: 3 }],
  });
  const { getByText } = render(<ConversasListScreen />);
  expect(getByText("Bia")).toBeTruthy();
  expect(getByText("oi")).toBeTruthy();
  expect(getByText("3")).toBeTruthy();
  fireEvent.press(getByText("Bia"));
  expect(router.push).toHaveBeenCalledWith("/conversa/a1");
});

it("sem badge quando naoLidas e 0", () => {
  mockUseMinhasConversas.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [{ ...conversaBase, id: "a2", outroNome: "Léo", naoLidas: 0 }],
  });
  const { queryByText } = render(<ConversasListScreen />);
  expect(queryByText("0")).toBeNull();
});
