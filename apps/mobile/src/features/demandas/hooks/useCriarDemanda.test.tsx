import { renderHook } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { demandas: { criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useCriarDemanda } from "./useCriarDemanda";

const wrapper = criarWrapperQuery();

it("injeta clienteId, chama repo, retorna id e invalida ['demandas','abertas']", async () => {
  (repositories.demandas.criar as jest.Mock).mockResolvedValue({ id: "d9" });
  const spy = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useCriarDemanda(), { wrapper });
  const r = await result.current.mutateAsync({
    categoriaId: "c1", titulo: "Pintar", descricao: "sala", orcamentoMaximo: 500, urgencia: "Normal",
    enderecoCidade: "Floripa", enderecoBairro: "Centro", enderecoCompleto: "Rua A, 10", dataDesejada: null,
  });
  expect(repositories.demandas.criar).toHaveBeenCalledWith(expect.objectContaining({ clienteId: "u1", titulo: "Pintar" }));
  expect(r).toEqual({ id: "d9" });
  expect(spy).toHaveBeenCalledWith({ queryKey: ["demandas", "abertas"] });
});
