import { render, fireEvent } from "@testing-library/react-native";
import type { Conversa, Mensagem } from "@/features/conversas/types/conversa.types";
import type { Proposta } from "@/features/propostas/types/proposta.types";
import { RepoError } from "@/shared/api/repositories";

let mockAuthState: { usuarioId: string | null };
let mockUiState: { modo: "contratar" | "prestar" };

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockAuthState),
}));
jest.mock("@/shared/store/uiModeStore", () => ({
  useUiModeStore: (sel: (s: unknown) => unknown) => sel(mockUiState),
}));

jest.mock("@/features/conversas/hooks/useMensagensRealtime", () => ({
  useMensagensRealtime: jest.fn(),
}));
jest.mock("@/features/conversas/hooks/useConversa", () => ({ useConversa: jest.fn() }));
jest.mock("@/features/conversas/hooks/useMensagensInfinite", () => ({
  useMensagensInfinite: jest.fn(),
}));
jest.mock("@/features/conversas/hooks/useEnviarTexto", () => ({ useEnviarTexto: jest.fn() }));
jest.mock("@/features/conversas/hooks/useMarcarLidas", () => ({ useMarcarLidas: jest.fn() }));
jest.mock("@/features/propostas/hooks/usePropostasDaConversa", () => ({
  usePropostasDaConversa: jest.fn(),
}));
jest.mock("@/features/propostas/hooks/useAceitarProposta", () => ({
  useAceitarProposta: jest.fn(),
}));
jest.mock("@/features/propostas/hooks/useRecusarProposta", () => ({
  useRecusarProposta: jest.fn(),
}));

import { useConversa } from "@/features/conversas/hooks/useConversa";
import { useMensagensInfinite } from "@/features/conversas/hooks/useMensagensInfinite";
import { usePropostasDaConversa } from "@/features/propostas/hooks/usePropostasDaConversa";
import { useEnviarTexto } from "@/features/conversas/hooks/useEnviarTexto";
import { useMarcarLidas } from "@/features/conversas/hooks/useMarcarLidas";
import { useAceitarProposta } from "@/features/propostas/hooks/useAceitarProposta";
import { useRecusarProposta } from "@/features/propostas/hooks/useRecusarProposta";
import { router } from "expo-router";
import { ConversaScreen, erroProposta } from "./ConversaScreen";

const mockRouterPush = router.push as jest.Mock;
const mockUseConversa = useConversa as jest.Mock;
const mockUseMensagensInfinite = useMensagensInfinite as jest.Mock;
const mockUsePropostasDaConversa = usePropostasDaConversa as jest.Mock;
const mockUseEnviarTexto = useEnviarTexto as jest.Mock;
const mockUseMarcarLidas = useMarcarLidas as jest.Mock;
const mockUseAceitarProposta = useAceitarProposta as jest.Mock;
const mockUseRecusarProposta = useRecusarProposta as jest.Mock;

const conversa: Conversa = {
  id: "a1",
  tipo: "DEMANDA",
  demandaId: "d1",
  clienteId: "c1",
  prestadorId: "p1",
  status: "ATIVA",
  ultimaMensagem: null,
  dataUltimaMensagem: null,
  naoLidas: 0,
  outroId: "p1",
  outroNome: "Bia",
  outroFotoUrl: null,
  createdAt: "2026-03-01T00:00:00Z",
};

const mkMsg = (o: Partial<Mensagem>): Mensagem => ({
  id: "m1",
  conversaId: "a1",
  remetenteId: "p1",
  tipo: "TEXTO",
  corpo: "oi",
  propostaId: null,
  lida: true,
  createdAt: "2026-03-02T00:00:00Z",
  ...o,
});

const mkProposta = (o: Partial<Proposta>): Proposta => ({
  id: "p1",
  demandaId: "d1",
  conversaId: "a1",
  prestadorId: "p1",
  clienteId: "c1",
  valor: 300,
  taxaPlataforma: 60,
  valorLiquidoPrestador: 240,
  descricao: "Pintura",
  prazoExecucao: "3 dias",
  validadeDias: 7,
  status: "ENVIADA",
  createdAt: "2026-03-01T00:00:00Z",
  ...o,
});

function mensagensQ(mensagens: Mensagem[]) {
  return {
    data: { pages: [{ itens: mensagens, proximoCursor: null }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  };
}

let aceitarMutate: jest.Mock;
let recusarMutate: jest.Mock;
let enviarMutate: jest.Mock;
let marcarLidasMutate: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = { usuarioId: "c1" };
  mockUiState = { modo: "contratar" };
  aceitarMutate = jest.fn();
  recusarMutate = jest.fn();
  enviarMutate = jest.fn();
  marcarLidasMutate = jest.fn();
  mockUseConversa.mockReturnValue({
    data: conversa,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUsePropostasDaConversa.mockReturnValue({ data: [] });
  mockUseMensagensInfinite.mockReturnValue(mensagensQ([]));
  mockUseEnviarTexto.mockReturnValue({ mutate: enviarMutate, isPending: false });
  mockUseMarcarLidas.mockReturnValue({ mutate: marcarLidasMutate });
  mockUseAceitarProposta.mockReturnValue({ mutate: aceitarMutate, isPending: false, error: null });
  mockUseRecusarProposta.mockReturnValue({ mutate: recusarMutate, isPending: false, error: null });
});

it("cliente vê Aceitar na proposta inline e o press chama aceitar.mutate(propostaId)", () => {
  mockAuthState = { usuarioId: "c1" }; // = conversa.clienteId
  mockUseMensagensInfinite.mockReturnValue(
    mensagensQ([mkMsg({ id: "m1", tipo: "PROPOSTA", propostaId: "p1", lida: true })]),
  );
  mockUsePropostasDaConversa.mockReturnValue({
    data: [mkProposta({ id: "p1", status: "ENVIADA", valor: 300 })],
  });

  const { getByText } = render(<ConversaScreen id="a1" />);

  expect(getByText("Aceitar")).toBeTruthy();
  fireEvent.press(getByText("Aceitar"));
  expect(aceitarMutate).toHaveBeenCalledWith("p1");
});

it("prestador (não é o cliente da conversa) não vê Aceitar", () => {
  mockAuthState = { usuarioId: "p1" }; // = conversa.prestadorId, != clienteId
  mockUseMensagensInfinite.mockReturnValue(
    mensagensQ([mkMsg({ id: "m1", tipo: "PROPOSTA", propostaId: "p1" })]),
  );
  mockUsePropostasDaConversa.mockReturnValue({
    data: [mkProposta({ id: "p1", status: "ENVIADA" })],
  });

  const { queryByText } = render(<ConversaScreen id="a1" />);

  expect(queryByText("Aceitar")).toBeNull();
});

it("mensagem CONTRATO_GERADO renderiza o card com o valor da proposta", () => {
  mockUseMensagensInfinite.mockReturnValue(
    mensagensQ([mkMsg({ id: "m1", tipo: "CONTRATO_GERADO", propostaId: "p1", corpo: "" })]),
  );
  mockUsePropostasDaConversa.mockReturnValue({ data: [mkProposta({ id: "p1", valor: 300 })] });

  const { getByText } = render(<ConversaScreen id="a1" />);

  expect(getByText(/Contrato gerado/)).toBeTruthy();
  expect(getByText("R$ 300,00")).toBeTruthy();

  fireEvent.press(getByText(/Contrato gerado/));
  expect(mockRouterPush).toHaveBeenCalledWith("/contratacao/p1");
});

it("ação 'Enviar proposta' só aparece para o prestador no modo prestar e navega no press", () => {
  mockAuthState = { usuarioId: "p1" }; // = conversa.prestadorId
  mockUiState = { modo: "prestar" };

  const { getByText, queryByText, rerender } = render(<ConversaScreen id="a1" />);

  expect(getByText("Enviar proposta")).toBeTruthy();
  fireEvent.press(getByText("Enviar proposta"));
  expect(mockRouterPush).toHaveBeenCalledWith("/conversa/a1/nova-proposta");

  mockUiState = { modo: "contratar" };
  rerender(<ConversaScreen id="a1" />);
  expect(queryByText("Enviar proposta")).toBeNull();
});

it("digitar no campo e pressionar Enviar chama enviar.mutate com o texto", () => {
  const { getByText, getByPlaceholderText } = render(<ConversaScreen id="a1" />);

  fireEvent.changeText(getByPlaceholderText("Mensagem"), "ola");
  fireEvent.press(getByText("Enviar"));

  expect(enviarMutate).toHaveBeenCalledWith("ola");
});

it("cabeçalho mostra o nome do outro usuário da conversa", () => {
  const { getByText } = render(<ConversaScreen id="a1" />);

  expect(getByText("Bia")).toBeTruthy();
});

describe("erroProposta", () => {
  it("null quando sem erro", () => expect(erroProposta(null)).toBeNull());
  it.each([
    ["nao_autorizado", "Só o cliente da demanda pode aceitar esta proposta."],
    ["conflito", "Esta proposta não está mais disponível."],
    ["nao_encontrado", "Proposta não encontrada."],
  ] as const)("mapeia RepoError %s", (code, msg) =>
    expect(erroProposta(new RepoError(code as never, "x"))).toBe(msg));
  it("generico p/ não-RepoError", () =>
    expect(erroProposta(new Error("x"))).toBe("Não foi possível concluir. Tente de novo."));
});
