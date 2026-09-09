import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { demandas: { listarAbertas: jest.fn(), obter: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { useDemandasAbertas } from "./useDemandasAbertas";
import { useDemanda } from "./useDemanda";

const wrapper = criarWrapperQuery();

beforeEach(() => jest.clearAllMocks());

it("useDemandasAbertas passa filtros e pagina por cursor", async () => {
  (repositories.demandas.listarAbertas as jest.Mock)
    .mockResolvedValueOnce({ itens: [{ id: "d1" }], proximoCursor: "2026-03-02T00:00:00Z" })
    .mockResolvedValueOnce({ itens: [{ id: "d2" }], proximoCursor: null });
  const { result } = renderHook(() => useDemandasAbertas({ cidade: "Floripa" }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.demandas.listarAbertas).toHaveBeenCalledWith({ cidade: "Floripa" }, { limite: 20, cursor: undefined });
  result.current.fetchNextPage();
  await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect((repositories.demandas.listarAbertas as jest.Mock).mock.calls[1][1]).toEqual({ limite: 20, cursor: "2026-03-02T00:00:00Z" });
});

it("useDemanda busca o detalhe por id e fica disabled sem id", async () => {
  (repositories.demandas.obter as jest.Mock).mockResolvedValue({ id: "d1", titulo: "Pintar" });
  const vazio = renderHook(() => useDemanda(""), { wrapper });
  expect(vazio.result.current.fetchStatus).toBe("idle");
  const { result } = renderHook(() => useDemanda("d1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.demandas.obter).toHaveBeenCalledWith("d1");
});
