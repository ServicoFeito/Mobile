import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { prestadores: { listarPorCategoria: jest.fn(), buscar: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { usePrestadoresPorCategoria } from "./usePrestadoresPorCategoria";
import { useBuscarPrestadores } from "./useBuscarPrestadores";

const wrapper = criarWrapperQuery();
const pagina = (ids: string[], prox: string | null) => ({
  itens: ids.map((id) => ({ usuarioId: id, nome: id, cidade: null, bairro: null, tituloProfissional: null, precoBase: null, rating: null, totalAvaliacoes: null, verificado: false, disponivel: false, fotoPerfilUrl: null, avatarCorHex: null })),
  proximoCursor: prox,
});

beforeEach(() => jest.clearAllMocks());

it("usePrestadoresPorCategoria busca a 1ª página e expõe hasNextPage pelo proximoCursor", async () => {
  (repositories.prestadores.listarPorCategoria as jest.Mock).mockResolvedValue(pagina(["p1", "p2"], "2"));
  const { result } = renderHook(() => usePrestadoresPorCategoria("c1", {}), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.listarPorCategoria).toHaveBeenCalledWith("c1", {}, { limite: 20, cursor: undefined });
  expect(result.current.hasNextPage).toBe(true);
});

it("fetchNextPage passa o proximoCursor como cursor", async () => {
  (repositories.prestadores.listarPorCategoria as jest.Mock)
    .mockResolvedValueOnce(pagina(["p1"], "20"))
    .mockResolvedValueOnce(pagina(["p2"], null));
  const { result } = renderHook(() => usePrestadoresPorCategoria("c1", {}), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  result.current.fetchNextPage(); // NÃO await — deixa o re-render pendente pro act-loop do RTL
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect((repositories.prestadores.listarPorCategoria as jest.Mock).mock.calls[1][2]).toEqual({ limite: 20, cursor: "20" });
});

it("useBuscarPrestadores fica disabled com termo < 2 chars", async () => {
  const { result } = renderHook(() => useBuscarPrestadores("a", {}), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(repositories.prestadores.buscar).not.toHaveBeenCalled();
});

it("useBuscarPrestadores dispara com termo >= 2 chars", async () => {
  (repositories.prestadores.buscar as jest.Mock).mockResolvedValue(pagina(["p1"], null));
  const { result } = renderHook(() => useBuscarPrestadores("jo", { cidade: "Floripa" }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.buscar).toHaveBeenCalledWith("jo", { cidade: "Floripa" }, { limite: 20, cursor: undefined });
});
