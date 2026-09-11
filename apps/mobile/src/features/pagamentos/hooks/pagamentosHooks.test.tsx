import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import type { Pagamento } from "@/features/pagamentos/types/pagamento.types";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    pagamentos: { buscarPendente: jest.fn(), criarCobranca: jest.fn(), obterPorId: jest.fn() },
  },
}));

jest.mock("@/shared/query/queryClient", () => ({
  queryClient: { setQueryData: jest.fn(), invalidateQueries: jest.fn() },
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { usePagamentoPendente } from "./usePagamentoPendente";
import { useCriarCobranca } from "./useCriarCobranca";
import { usePagamentoStatus } from "./usePagamentoStatus";

const pagamento: Pagamento = {
  id: "pg1",
  contratacaoId: "ct1",
  valor: 100,
  tipo: "ENTRADA",
  status: "PENDENTE",
  txid: null,
  efiLocId: null,
  pixCopiaCola: null,
  qrCodeBase64: null,
  dataPagamento: null,
  createdAt: "2026-09-11T00:00:00.000Z",
};

let wrapper: ReturnType<typeof criarWrapperQuery>;

beforeEach(() => {
  jest.clearAllMocks();
  wrapper = criarWrapperQuery();
});

it("usePagamentoPendente busca o pagamento pendente da contratação", async () => {
  (repositories.pagamentos.buscarPendente as jest.Mock).mockResolvedValue(pagamento);
  const { result } = renderHook(() => usePagamentoPendente("c1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.pagamentos.buscarPendente).toHaveBeenCalledWith("c1");
  expect(result.current.data).toEqual(pagamento);
});

it("usePagamentoPendente com contratacaoId vazio fica idle e não chama o repo", () => {
  const { result } = renderHook(() => usePagamentoPendente(""), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(repositories.pagamentos.buscarPendente).not.toHaveBeenCalled();
});

it("useCriarCobranca em sucesso grava o pagamento no cache com a chave dele", async () => {
  (repositories.pagamentos.criarCobranca as jest.Mock).mockResolvedValue(pagamento);
  const { result } = renderHook(() => useCriarCobranca(), { wrapper });

  result.current.mutate("pg1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.pagamentos.criarCobranca).toHaveBeenCalledWith("pg1");
  expect(queryClient.setQueryData).toHaveBeenCalledWith(["pagamento", "pg1"], pagamento);
});

it("usePagamentoStatus busca o pagamento pelo id", async () => {
  (repositories.pagamentos.obterPorId as jest.Mock).mockResolvedValue(pagamento);
  const { result } = renderHook(() => usePagamentoStatus("p1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.pagamentos.obterPorId).toHaveBeenCalledWith("p1");
  expect(result.current.data).toEqual(pagamento);
});

it("usePagamentoStatus com pagamentoId null fica idle e não chama o repo", () => {
  const { result } = renderHook(() => usePagamentoStatus(null), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(repositories.pagamentos.obterPorId).not.toHaveBeenCalled();
});
