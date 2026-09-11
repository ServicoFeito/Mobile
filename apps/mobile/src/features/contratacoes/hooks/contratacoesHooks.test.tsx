import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    contratacoes: { obterPorProposta: jest.fn(), listarMinhas: jest.fn(), cancelar: jest.fn() },
  },
}));

jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) => sel({ usuarioId: "u1" }),
}));

jest.mock("@/shared/query/queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useContratacaoPorProposta } from "./useContratacaoPorProposta";
import { useMinhasContratacoes } from "./useMinhasContratacoes";
import { useCancelarContratacao } from "./useCancelarContratacao";

let wrapper: ReturnType<typeof criarWrapperQuery>;

beforeEach(() => {
  jest.clearAllMocks();
  wrapper = criarWrapperQuery();
});

it("useContratacaoPorProposta busca a contratação pela proposta na perspectiva do usuário", async () => {
  (repositories.contratacoes.obterPorProposta as jest.Mock).mockResolvedValue({ id: "ct1" });
  const { result } = renderHook(() => useContratacaoPorProposta("p1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.contratacoes.obterPorProposta).toHaveBeenCalledWith("p1", "u1");
  expect(result.current.data).toEqual({ id: "ct1" });
});

it("useMinhasContratacoes lista as contratações do usuário logado", async () => {
  (repositories.contratacoes.listarMinhas as jest.Mock).mockResolvedValue([{ id: "ct1" }]);
  const { result } = renderHook(() => useMinhasContratacoes(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.contratacoes.listarMinhas).toHaveBeenCalledWith("u1");
  expect(result.current.data).toEqual([{ id: "ct1" }]);
});

it("useCancelarContratacao com demandaId invalida as 5 chaves relacionadas", async () => {
  (repositories.contratacoes.cancelar as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useCancelarContratacao("p1", "d1"), { wrapper });

  result.current.mutate("ct1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.contratacoes.cancelar).toHaveBeenCalledWith("ct1");
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["contratacao", "proposta", "p1"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["contratacoes", "minhas"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["demandas", "detalhe", "d1"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["demandas", "abertas"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(5);
});

it("useCancelarContratacao sem demandaId invalida só as 3 chaves incondicionais", async () => {
  (repositories.contratacoes.cancelar as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useCancelarContratacao("p1", null), { wrapper });

  result.current.mutate("ct1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["contratacao", "proposta", "p1"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["contratacoes", "minhas"],
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ["demandas", "detalhe", "d1"],
  });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ["demandas", "abertas"],
  });
});

it("useCancelarContratacao em erro não invalida nada", async () => {
  (repositories.contratacoes.cancelar as jest.Mock).mockRejectedValueOnce({ code: "conflito" });
  const { result } = renderHook(() => useCancelarContratacao("p1", "d1"), { wrapper });

  result.current.mutate("ct1");

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});
