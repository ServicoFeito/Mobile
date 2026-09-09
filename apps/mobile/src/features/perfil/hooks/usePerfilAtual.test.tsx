import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import { usePerfilAtual } from "./usePerfilAtual";

const supa = require("@/shared/api/supabaseClient").supabase;
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: any) => sel({ usuarioId: "u1" }),
}));

const wrapper = criarWrapperQuery();

it("busca a linha própria de usuarios", async () => {
  const single = jest.fn().mockResolvedValue({
    data: { id: "u1", nome: "Ana", telefone: null, cidade: "Floripa" },
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue({
    select: () => ({ eq: () => ({ single }) }),
  } as any);

  const { result } = renderHook(() => usePerfilAtual(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data?.nome).toBe("Ana");
  expect(supa.from).toHaveBeenCalledWith("usuarios");
});
