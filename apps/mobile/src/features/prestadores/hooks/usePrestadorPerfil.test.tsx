import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { prestadores: { obterPerfil: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { usePrestadorPerfil } from "./usePrestadorPerfil";

const wrapper = criarWrapperQuery();

it("busca o perfil pelo usuarioId", async () => {
  (repositories.prestadores.obterPerfil as jest.Mock).mockResolvedValue({ usuarioId: "p1", nome: "João", categorias: [], portfolio: [], disponibilidade: null });
  const { result } = renderHook(() => usePrestadorPerfil("p1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.obterPerfil).toHaveBeenCalledWith("p1");
  expect(result.current.data?.nome).toBe("João");
});

it("disabled quando usuarioId vazio", () => {
  const { result } = renderHook(() => usePrestadorPerfil(""), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
});
