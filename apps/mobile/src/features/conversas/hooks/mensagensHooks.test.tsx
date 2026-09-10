import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    mensagens: {
      listar: jest.fn(),
      enviarTexto: jest.fn(),
      marcarLidas: jest.fn(),
    },
  },
}));

jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) => sel({ usuarioId: "u1" }),
}));

const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
jest.mock("@/shared/query/queryClient", () => ({
  queryClient: {
    getQueryData: (...a: unknown[]) => mockGetQueryData(...a),
    setQueryData: (...a: unknown[]) => mockSetQueryData(...a),
    invalidateQueries: (...a: unknown[]) => mockInvalidateQueries(...a),
  },
}));

import { repositories } from "@/shared/api/repositories";
import { useMensagensInfinite } from "./useMensagensInfinite";
import { useEnviarTexto } from "./useEnviarTexto";
import { useMarcarLidas } from "./useMarcarLidas";

const wrapper = criarWrapperQuery();

beforeEach(() => jest.clearAllMocks());

it("useMensagensInfinite pagina por cursor (Ruling R-F)", async () => {
  (repositories.mensagens.listar as jest.Mock)
    .mockResolvedValueOnce({ itens: [{ id: "m1" }, { id: "m2" }], proximoCursor: "c1" })
    .mockResolvedValueOnce({ itens: [{ id: "m3" }], proximoCursor: null });

  const { result } = renderHook(() => useMensagensInfinite("a1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(repositories.mensagens.listar).toHaveBeenCalledWith("a1", { limite: 30, cursor: undefined });
  expect(result.current.hasNextPage).toBe(true);

  result.current.fetchNextPage();

  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect((repositories.mensagens.listar as jest.Mock).mock.calls[1]).toEqual([
    "a1",
    { limite: 30, cursor: "c1" },
  ]);
});

it("useEnviarTexto envia o texto e nao invalida cache", async () => {
  (repositories.mensagens.enviarTexto as jest.Mock).mockResolvedValue({ id: "m9" });

  const { result } = renderHook(() => useEnviarTexto("a1"), { wrapper });
  result.current.mutate("oi");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.mensagens.enviarTexto).toHaveBeenCalledWith("a1", "oi", "u1");
  expect(mockInvalidateQueries).not.toHaveBeenCalled();
});

it("useMarcarLidas resolve o papel do cache e zera naoLidas no sucesso", async () => {
  mockGetQueryData.mockImplementation((key: unknown[]) =>
    key[0] === "conversa"
      ? { id: "a1", clienteId: "u1", prestadorId: "u2", naoLidas: 3 }
      : undefined,
  );
  (repositories.mensagens.marcarLidas as jest.Mock).mockResolvedValue(undefined);

  const { result } = renderHook(() => useMarcarLidas("a1"), { wrapper });
  result.current.mutate();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.mensagens.marcarLidas).toHaveBeenCalledWith("a1", "u1", "CLIENTE");
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["conversas", "minhas"] });

  const call = mockSetQueryData.mock.calls.find((c) => Array.isArray(c[0]) && c[0][0] === "conversa");
  expect(call?.[0]).toEqual(["conversa", "a1"]);
  const updater = call?.[1] as (c: { naoLidas: number } | undefined) => unknown;
  expect(updater({ id: "a1", naoLidas: 3 } as never)).toEqual({ id: "a1", naoLidas: 0 });
  expect(updater(undefined)).toBeUndefined();
});

it("useMarcarLidas vira no-op quando a conversa nao esta no cache", async () => {
  mockGetQueryData.mockReturnValue(undefined);

  const { result } = renderHook(() => useMarcarLidas("a1"), { wrapper });
  result.current.mutate();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.mensagens.marcarLidas).not.toHaveBeenCalled();
});
