import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { categorias: { listar: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { useCategorias } from "./useCategorias";

const wrapper = criarWrapperQuery();

it("chama repositories.categorias.listar e devolve os dados", async () => {
  (repositories.categorias.listar as jest.Mock).mockResolvedValue([
    { id: "c1", nome: "Diarista", descricao: null, iconeKey: "broom", popular: true, precoMedioHora: 50 },
  ]);
  const { result } = renderHook(() => useCategorias(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.categorias.listar).toHaveBeenCalled();
  expect(result.current.data?.[0]?.nome).toBe("Diarista");
});
