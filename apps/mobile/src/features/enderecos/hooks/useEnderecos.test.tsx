import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { enderecos: { listarMeus: jest.fn(), criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useMeusEnderecos } from "./useMeusEnderecos";
import { useCriarEndereco } from "./useCriarEndereco";

const wrapper = criarWrapperQuery();

it("useMeusEnderecos lista", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([{ id: "e1", cidade: "Floripa" }]);
  const { result } = renderHook(() => useMeusEnderecos(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0]?.id).toBe("e1");
});

it("useCriarEndereco injeta usuarioId, retorna o novo e invalida ['enderecos','meus']", async () => {
  (repositories.enderecos.criar as jest.Mock).mockResolvedValue({ id: "e9", cidade: "Floripa" });
  const spy = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useCriarEndereco(), { wrapper });
  const novo = await result.current.mutateAsync({
    identificacao: "Casa", cep: null, estado: "SC", cidade: "Floripa", bairro: "Centro",
    logradouro: "Rua A", numero: "10", complemento: null, principal: false,
  });
  expect(repositories.enderecos.criar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "u1", cidade: "Floripa" }));
  expect(novo).toEqual({ id: "e9", cidade: "Floripa" });
  expect(spy).toHaveBeenCalledWith({ queryKey: ["enderecos", "meus"] });
});
