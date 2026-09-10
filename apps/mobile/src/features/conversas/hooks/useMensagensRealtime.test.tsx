import { renderHook } from "@testing-library/react-native";

const mockHandlers: Array<(p: unknown) => void> = [];
const mockSubscribe = jest.fn((cb?: (s: string) => void) => {
  cb?.("SUBSCRIBED");
  return mockCanalFake;
});
const mockCanalFake = {
  on: jest.fn((_e: string, _f: unknown, h: (p: unknown) => void) => {
    mockHandlers.push(h);
    return mockCanalFake;
  }),
  subscribe: mockSubscribe,
};
jest.mock("@/shared/api/supabaseClient", () => ({
  supabase: { channel: jest.fn(() => mockCanalFake), removeChannel: jest.fn() },
}));
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
jest.mock("@/shared/query/queryClient", () => ({
  queryClient: {
    setQueryData: (...a: unknown[]) => mockSetQueryData(...a),
    invalidateQueries: (...a: unknown[]) => mockInvalidateQueries(...a),
  },
}));

import { supabase } from "@/shared/api/supabaseClient";
import { useMensagensRealtime } from "./useMensagensRealtime";

beforeEach(() => {
  jest.clearAllMocks();
  mockHandlers.length = 0;
});

it("assina o canal da conversa e invalida no SUBSCRIBED", () => {
  renderHook(() => useMensagensRealtime("a1"));
  expect(supabase.channel as jest.Mock).toHaveBeenCalledWith("msgs:a1");
  expect(mockCanalFake.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({ event: "INSERT", table: "mensagens", filter: "conversa_id=eq.a1" }),
    expect.any(Function),
  );
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["mensagens", "a1"] });
});

it("prepend na pagina 0 via setQueryData, com dedup por id", () => {
  renderHook(() => useMensagensRealtime("a1"));
  const h = mockHandlers[0]!;
  h({
    new: {
      id: "m2",
      conversa_id: "a1",
      remetente_id: "u2",
      tipo: "TEXTO",
      corpo: "oi",
      proposta_id: null,
      lida: false,
      created_at: "2026-03-03T00:00:05Z",
    },
  });
  const updater = mockSetQueryData.mock.calls[0]![1] as (p: unknown) => unknown;
  const prev = {
    pageParams: [undefined],
    pages: [{ itens: [{ id: "m1" }], proximoCursor: null }],
  };
  const depois = updater(prev) as { pages: Array<{ itens: Array<{ id: string }> }> };
  expect(depois.pages[0]!.itens.map((m) => m.id)).toEqual(["m2", "m1"]);
  expect(
    updater({
      pageParams: [undefined],
      pages: [{ itens: [{ id: "m2" }], proximoCursor: null }],
    }),
  ).toEqual({
    pageParams: [undefined],
    pages: [{ itens: [{ id: "m2" }], proximoCursor: null }],
  });
});

it("removeChannel no unmount", () => {
  const { unmount } = renderHook(() => useMensagensRealtime("a1"));
  unmount();
  expect(supabase.removeChannel as jest.Mock).toHaveBeenCalledWith(mockCanalFake);
});
