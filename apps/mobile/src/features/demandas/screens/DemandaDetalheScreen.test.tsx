import { render, fireEvent, waitFor } from "@testing-library/react-native";
import type { DemandaDetalhe } from "@/features/demandas/types/demanda.types";
import { RepoError } from "@/shared/api/repositories";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

jest.mock("@/features/demandas/hooks/useDemanda", () => ({
  useDemanda: jest.fn(),
}));
jest.mock("@/features/conversas/hooks/useIniciarConversa", () => ({
  useIniciarConversa: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) => sel({ usuarioId: "prest-7" }),
}));

let mockModo: "contratar" | "prestar" = "prestar";
jest.mock("@/shared/store/uiModeStore", () => ({
  useUiModeStore: (sel: (s: { modo: "contratar" | "prestar" }) => unknown) => sel({ modo: mockModo }),
}));

import { router } from "expo-router";
import { useDemanda } from "@/features/demandas/hooks/useDemanda";
import { useIniciarConversa } from "@/features/conversas/hooks/useIniciarConversa";
import { DemandaDetalheScreen } from "./DemandaDetalheScreen";

const demanda: DemandaDetalhe = {
  id: "dem-1",
  titulo: "Pintar sala",
  descricao: "Duas paredes",
  categoriaId: "cat-1",
  categoriaNome: "Pintura",
  enderecoCidade: "Florianópolis",
  enderecoBairro: "Centro",
  orcamentoMaximo: 500,
  urgencia: "media",
  status: "aberta",
  totalPropostas: 2,
  createdAt: "2026-09-01T00:00:00Z",
  enderecoCompleto: "Rua A, 10",
  dataDesejada: "2026-09-20",
  clienteNome: "Maria",
};

const iniciarDemanda = jest.fn().mockResolvedValue({ id: "conv-2" });

beforeEach(() => {
  jest.clearAllMocks();
  mockModo = "prestar";
  iniciarDemanda.mockResolvedValue({ id: "conv-2" });
  (useDemanda as jest.Mock).mockReturnValue({ isLoading: false, isError: false, data: demanda });
  (useIniciarConversa as jest.Mock).mockReturnValue({
    iniciarDireta: jest.fn(),
    iniciarDemanda,
    pendente: false,
  });
});

it("no modo prestar mostra 'Tenho interesse' e inicia conversa de demanda", async () => {
  const { getByText } = render(<DemandaDetalheScreen id="dem-1" />);
  fireEvent.press(getByText("Tenho interesse"));
  await waitFor(() => expect(iniciarDemanda).toHaveBeenCalledWith("dem-1", "prest-7"));
  expect(router.push).toHaveBeenCalledWith("/conversa/conv-2");
});

it("no modo contratar não mostra o botão nem o texto placeholder antigo", () => {
  mockModo = "contratar";
  const { queryByText } = render(<DemandaDetalheScreen id="dem-1" />);
  expect(queryByText("Tenho interesse")).toBeNull();
  expect(queryByText("Iniciar conversa com o cliente estará disponível em breve.")).toBeNull();
});

it("mostra erro inline e não navega quando iniciar conversa falha", async () => {
  iniciarDemanda.mockRejectedValue(new RepoError("conflito", "x"));
  const { getByText } = render(<DemandaDetalheScreen id="dem-1" />);

  fireEvent.press(getByText("Tenho interesse"));

  await waitFor(() => expect(getByText(traduzErroRepo(new RepoError("conflito", "x")))).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
});
