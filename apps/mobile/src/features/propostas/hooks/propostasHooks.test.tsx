import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    propostas: {
      daConversa: jest.fn(),
      criar: jest.fn(),
      recusar: jest.fn(),
      aceitar: jest.fn(),
    },
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
import { usePropostasDaConversa } from "./usePropostasDaConversa";
import { useCriarProposta } from "./useCriarProposta";
import { useRecusarProposta } from "./useRecusarProposta";
import { useAceitarProposta } from "./useAceitarProposta";

const invalidate = queryClient.invalidateQueries as jest.Mock;

let wrapper: ReturnType<typeof criarWrapperQuery>;
beforeEach(() => {
  jest.clearAllMocks();
  wrapper = criarWrapperQuery();
});

it("usePropostasDaConversa busca as propostas da conversa e expõe data", async () => {
  const propostas = [{ id: "p1" }, { id: "p2" }];
  (repositories.propostas.daConversa as jest.Mock).mockResolvedValue(propostas);

  const { result } = renderHook(() => usePropostasDaConversa("a1"), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.propostas.daConversa).toHaveBeenCalledWith("a1");
  expect(result.current.data).toEqual(propostas);
});

it("useCriarProposta mescla prestadorId do authStore e invalida a lista da conversa", async () => {
  (repositories.propostas.criar as jest.Mock).mockResolvedValue({ id: "p9" });

  const { result } = renderHook(() => useCriarProposta(), { wrapper });
  result.current.mutate({
    conversaId: "a1",
    demandaId: "d1",
    clienteId: "u1",
    valor: 300,
    descricao: "x",
    prazoExecucao: null,
    validadeDias: 7,
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.propostas.criar).toHaveBeenCalledWith(
    expect.objectContaining({ prestadorId: "u1", conversaId: "a1", valor: 300 }),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["propostas", "conversa", "a1"] });
});

it("useAceitarProposta sucesso invalida todas as chaves afetadas incluindo detalhe da demanda", async () => {
  (repositories.propostas.aceitar as jest.Mock).mockResolvedValue({ contratacaoId: "c1" });

  const { result } = renderHook(() => useAceitarProposta("a1", "d1"), { wrapper });
  result.current.mutate("p1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const chaves = invalidate.mock.calls.map((c) => c[0].queryKey);
  expect(chaves).toContainEqual(["propostas", "conversa", "a1"]);
  expect(chaves).toContainEqual(["mensagens", "a1"]);
  expect(chaves).toContainEqual(["conversa", "a1"]);
  expect(chaves).toContainEqual(["conversas", "minhas"]);
  expect(chaves).toContainEqual(["demandas", "abertas"]);
  expect(chaves).toContainEqual(["demandas", "detalhe", "d1"]);
  expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(6);
});

it("useAceitarProposta sem demandaId não invalida o detalhe da demanda", async () => {
  (repositories.propostas.aceitar as jest.Mock).mockResolvedValue({ contratacaoId: "c1" });

  const { result } = renderHook(() => useAceitarProposta("a1", null), { wrapper });
  result.current.mutate("p1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const chaves = invalidate.mock.calls.map((c) => c[0].queryKey);
  expect(chaves).toContainEqual(["propostas", "conversa", "a1"]);
  expect(chaves).toContainEqual(["mensagens", "a1"]);
  expect(chaves).toContainEqual(["conversa", "a1"]);
  expect(chaves).toContainEqual(["conversas", "minhas"]);
  expect(chaves).toContainEqual(["demandas", "abertas"]);
  expect(chaves.some((k) => k[0] === "demandas" && k[1] === "detalhe")).toBe(false);
  expect(invalidate).toHaveBeenCalledTimes(5);
});

it("useAceitarProposta em erro marca isError e não invalida nada", async () => {
  (repositories.propostas.aceitar as jest.Mock).mockRejectedValue({ code: "conflito" });

  const { result } = renderHook(() => useAceitarProposta("a1", "d1"), { wrapper });
  result.current.mutate("p1");

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(invalidate).not.toHaveBeenCalled();
});

it("useRecusarProposta chama recusar e invalida a lista da conversa", async () => {
  (repositories.propostas.recusar as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useRecusarProposta("a1"), { wrapper });
  result.current.mutate("p1");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.propostas.recusar).toHaveBeenCalledWith("p1");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["propostas", "conversa", "a1"] });
});
