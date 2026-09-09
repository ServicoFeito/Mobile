import { renderHook, act } from "@testing-library/react-native";
import { useDebounce } from "./useDebounce";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("devolve o valor inicial de imediato", () => {
  const { result } = renderHook(() => useDebounce("a", 300));
  expect(result.current).toBe("a");
});

it("só atualiza depois de `ms` sem novas mudanças", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
    initialProps: { v: "a" },
  });
  rerender({ v: "ab" });
  rerender({ v: "abc" });
  expect(result.current).toBe("a"); // ainda não passou o tempo
  act(() => jest.advanceTimersByTime(299));
  expect(result.current).toBe("a");
  act(() => jest.advanceTimersByTime(1));
  expect(result.current).toBe("abc"); // último valor
});
