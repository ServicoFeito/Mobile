import { render, fireEvent, act } from "@testing-library/react-native";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";
import { RepoError } from "@/shared/api/repositories";

const mockRouterBack = jest.fn();
const mockClipboardSetStringAsync = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: () => mockRouterBack() },
}));
jest.mock("expo-clipboard", () => ({
  setStringAsync: (v: string) => mockClipboardSetStringAsync(v),
}));

jest.mock("@/features/pagamentos/hooks/usePagamentoPendente", () => ({
  usePagamentoPendente: jest.fn(),
}));
jest.mock("@/features/pagamentos/hooks/useCriarCobranca", () => ({
  useCriarCobranca: jest.fn(),
}));
jest.mock("@/features/pagamentos/hooks/usePagamentoStatus", () => ({
  usePagamentoStatus: jest.fn(),
}));

import { usePagamentoPendente } from "@/features/pagamentos/hooks/usePagamentoPendente";
import { useCriarCobranca } from "@/features/pagamentos/hooks/useCriarCobranca";
import { usePagamentoStatus } from "@/features/pagamentos/hooks/usePagamentoStatus";
import { PagamentoScreen, erroPagamento } from "./PagamentoScreen";

const mockUsePagamentoPendente = usePagamentoPendente as jest.Mock;
const mockUseCriarCobranca = useCriarCobranca as jest.Mock;
const mockUsePagamentoStatus = usePagamentoStatus as jest.Mock;

const mkPagamento = (o: Partial<Pagamento>): Pagamento => ({
  id: "pg1",
  contratacaoId: "ct1",
  valor: 60,
  tipo: "ENTRADA",
  status: "PENDENTE",
  txid: null,
  efiLocId: null,
  pixCopiaCola: null,
  qrCodeBase64: null,
  dataPagamento: null,
  createdAt: "2026-03-01T00:00:00Z",
  ...o,
});

let criarCobrancaMutate: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  criarCobrancaMutate = jest.fn();

  mockUseCriarCobranca.mockReturnValue({
    mutate: criarCobrancaMutate,
    isPending: false,
    error: null,
  });
  mockUsePagamentoStatus.mockReturnValue({ data: undefined, isLoading: false });
});

it("sem pagamento pendente: mostra 'Nada pendente pra pagar' e botão voltar", () => {
  mockUsePagamentoPendente.mockReturnValue({ data: null, isLoading: false });

  const { getByText } = render(<PagamentoScreen contratacaoId="ct1" />);

  expect(getByText("Nada pendente pra pagar.")).toBeTruthy();
  fireEvent.press(getByText("Voltar"));
  expect(mockRouterBack).toHaveBeenCalledTimes(1);
});

it("pagamento PENDENTE: dispara criarCobranca.mutate uma única vez no mount, mesmo após re-render", () => {
  const pendente = mkPagamento({ status: "PENDENTE" });
  mockUsePagamentoPendente.mockReturnValue({ data: pendente, isLoading: false });

  const { rerender } = render(<PagamentoScreen contratacaoId="ct1" />);

  // Simula um refetch do react-query: novo objeto (referência diferente),
  // mesmos valores de campo — é exatamente o caso que o guard de useRef
  // precisa cobrir (um `[data]` no deps do useEffect sozinho não bastaria).
  const pendenteRefetch = mkPagamento({ status: "PENDENTE" });
  mockUsePagamentoPendente.mockReturnValue({ data: pendenteRefetch, isLoading: false });
  rerender(<PagamentoScreen contratacaoId="ct1" />);

  expect(criarCobrancaMutate).toHaveBeenCalledTimes(1);
  expect(criarCobrancaMutate).toHaveBeenCalledWith("pg1");
});

it("status PROCESSANDO com qrCodeBase64/pixCopiaCola: renderiza QR e copia-e-cola; 'Copiar código' chama Clipboard.setStringAsync", async () => {
  const pendente = mkPagamento({ status: "PENDENTE" });
  mockUsePagamentoPendente.mockReturnValue({ data: pendente, isLoading: false });
  mockUsePagamentoStatus.mockReturnValue({
    data: mkPagamento({
      status: "PROCESSANDO",
      qrCodeBase64: "data:image/png;base64,ABC",
      pixCopiaCola: "00020126...copiacola",
    }),
    isLoading: false,
  });

  const { getByTestId, getByText } = render(<PagamentoScreen contratacaoId="ct1" />);

  expect(getByTestId("pagamento-qr")).toBeTruthy();
  expect(getByText("00020126...copiacola")).toBeTruthy();

  await act(async () => {
    fireEvent.press(getByText("Copiar código"));
  });

  expect(mockClipboardSetStringAsync).toHaveBeenCalledWith("00020126...copiacola");
});

it("status PAGO: mostra tela de sucesso; botão 'Voltar' chama router.back()", () => {
  const pendente = mkPagamento({ status: "PENDENTE" });
  mockUsePagamentoPendente.mockReturnValue({ data: pendente, isLoading: false });
  mockUsePagamentoStatus.mockReturnValue({
    data: mkPagamento({ status: "PAGO" }),
    isLoading: false,
  });

  const { getByText } = render(<PagamentoScreen contratacaoId="ct1" />);

  expect(getByText("Pagamento confirmado!")).toBeTruthy();
  fireEvent.press(getByText("Voltar"));
  expect(mockRouterBack).toHaveBeenCalledTimes(1);
});

it("erro na criação da cobrança: mostra erroPagamento(...) e 'Tentar de novo' rechama mutate", () => {
  const pendente = mkPagamento({ status: "PENDENTE" });
  mockUsePagamentoPendente.mockReturnValue({ data: pendente, isLoading: false });
  mockUseCriarCobranca.mockReturnValue({
    mutate: criarCobrancaMutate,
    isPending: false,
    error: new RepoError("desconhecido", "x"),
  });

  const { getByText } = render(<PagamentoScreen contratacaoId="ct1" />);

  expect(getByText("Não foi possível concluir. Tente de novo.")).toBeTruthy();

  fireEvent.press(getByText("Tentar de novo"));

  expect(criarCobrancaMutate).toHaveBeenCalledWith("pg1");
});

describe("erroPagamento", () => {
  it("null quando sem erro", () => expect(erroPagamento(null)).toBeNull());
  it("genérico p/ RepoError", () =>
    expect(erroPagamento(new RepoError("conflito", "x"))).toBe(
      "Não foi possível concluir. Tente de novo.",
    ));
  it("genérico p/ não-RepoError", () =>
    expect(erroPagamento(new Error("x"))).toBe("Não foi possível concluir. Tente de novo."));
});
