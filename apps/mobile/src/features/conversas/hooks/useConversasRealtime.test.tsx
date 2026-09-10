import { renderHook } from "@testing-library/react-native";

const mockOnCalls: Array<{ event: string; config: unknown; cb: () => void }> = [];
const mockCanalFake = {
  on: jest.fn((event: string, config: unknown, cb: () => void) => {
    mockOnCalls.push({ event, config, cb });
    return mockCanalFake;
  }),
  subscribe: jest.fn(() => mockCanalFake),
};
jest.mock("@/shared/api/supabaseClient", () => ({
  supabase: { channel: jest.fn(() => mockCanalFake), removeChannel: jest.fn() },
}));
const mockInvalidateQueries = jest.fn();
jest.mock("@/shared/query/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...a: unknown[]) => mockInvalidateQueries(...a),
  },
}));
let mockUsuarioId: string | null = "u1";
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) =>
    sel({ usuarioId: mockUsuarioId }),
}));

import { supabase } from "@/shared/api/supabaseClient";
import { useConversasRealtime } from "./useConversasRealtime";

beforeEach(() => {
  jest.clearAllMocks();
  mockOnCalls.length = 0;
  mockUsuarioId = "u1";
});

it("sem usuarioId nao abre canal", () => {
  mockUsuarioId = null;
  renderHook(() => useConversasRealtime());
  expect(supabase.channel as jest.Mock).not.toHaveBeenCalled();
});

it("assina conversas do usuario com dois filtros e invalida no evento", () => {
  renderHook(() => useConversasRealtime());
  expect(supabase.channel as jest.Mock).toHaveBeenCalledWith("conversas:u1");
  expect(mockCanalFake.on).toHaveBeenCalledTimes(2);
  expect(mockOnCalls[0]!.event).toBe("postgres_changes");
  expect(mockOnCalls[0]!.config).toEqual({
    event: "*",
    schema: "public",
    table: "conversas",
    filter: "cliente_id=eq.u1",
  });
  expect(mockOnCalls[1]!.event).toBe("postgres_changes");
  expect(mockOnCalls[1]!.config).toEqual({
    event: "*",
    schema: "public",
    table: "conversas",
    filter: "prestador_id=eq.u1",
  });

  mockOnCalls[0]!.cb();
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });

  mockInvalidateQueries.mockClear();
  mockOnCalls[1]!.cb();
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ["conversas", "minhas"],
  });
});

it("removeChannel no unmount", () => {
  const { unmount } = renderHook(() => useConversasRealtime());
  unmount();
  expect(supabase.removeChannel as jest.Mock).toHaveBeenCalledWith(mockCanalFake);
});
