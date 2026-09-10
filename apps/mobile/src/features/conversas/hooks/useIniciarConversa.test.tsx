import { renderHook, act } from "@testing-library/react-native";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    conversas: { iniciarDireta: jest.fn(), iniciarDemanda: jest.fn() },
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
import { useIniciarConversa } from "./useIniciarConversa";

beforeEach(() => {
  jest.clearAllMocks();
});

it("iniciarDireta usa usuarioId como clienteId, devolve o id e invalida conversas/minhas", async () => {
  (repositories.conversas.iniciarDireta as jest.Mock).mockResolvedValue({ id: "c1" });
  const { result } = renderHook(() => useIniciarConversa());

  let devolvido: { id: string } | undefined;
  await act(async () => {
    devolvido = await result.current.iniciarDireta("u2");
  });

  expect(repositories.conversas.iniciarDireta).toHaveBeenCalledWith("u1", "u2");
  expect(devolvido).toEqual({ id: "c1" });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });
});

it("iniciarDemanda repassa demandaId + prestadorId, devolve o id e invalida conversas/minhas", async () => {
  (repositories.conversas.iniciarDemanda as jest.Mock).mockResolvedValue({ id: "c2" });
  const { result } = renderHook(() => useIniciarConversa());

  let devolvido: { id: string } | undefined;
  await act(async () => {
    devolvido = await result.current.iniciarDemanda("d1", "u2");
  });

  expect(repositories.conversas.iniciarDemanda).toHaveBeenCalledWith("d1", "u2");
  expect(devolvido).toEqual({ id: "c2" });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });
});
