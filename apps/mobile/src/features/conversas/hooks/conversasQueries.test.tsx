import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { conversas: { listarMinhas: jest.fn(), obter: jest.fn() } },
}));

jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { useMinhasConversas } from "./useMinhasConversas";
import { useConversa } from "./useConversa";

const wrapper = criarWrapperQuery();

beforeEach(() => jest.clearAllMocks());

it("useMinhasConversas lista as conversas do usuário logado", async () => {
  (repositories.conversas.listarMinhas as jest.Mock).mockResolvedValue([{ id: "c1" }]);
  const { result } = renderHook(() => useMinhasConversas(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.conversas.listarMinhas).toHaveBeenCalledWith("u1");
  expect(result.current.data).toEqual([{ id: "c1" }]);
});

it("useConversa busca a conversa por id na perspectiva do usuário", async () => {
  (repositories.conversas.obter as jest.Mock).mockResolvedValue({ id: "a1" });
  const { result } = renderHook(() => useConversa("a1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.conversas.obter).toHaveBeenCalledWith("a1", "u1");
  expect(result.current.data).toEqual({ id: "a1" });
});

it("useConversa fica idle sem id", () => {
  const { result } = renderHook(() => useConversa(""), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(repositories.conversas.obter).not.toHaveBeenCalled();
});
