import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import { useCompletarPerfil } from "./useCompletarPerfil";

const supa = require("@/shared/api/supabaseClient").supabase;
jest.mock("@/shared/store/authStore", () => ({ useAuthStore: (s: any) => s({ usuarioId: "u1" }) }));

const wrapper = criarWrapperQuery();

it("faz update em usuarios com id = usuarioId", async () => {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ update } as any);

  const { result } = renderHook(() => useCompletarPerfil(), { wrapper });
  result.current.mutate({ nome: "Ana", telefone: "48999", cidade: "Floripa" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(supa.from).toHaveBeenCalledWith("usuarios");
  expect(update).toHaveBeenCalledWith({ nome: "Ana", telefone: "48999", cidade: "Floripa" });
  expect(eq).toHaveBeenCalledWith("id", "u1");
});
