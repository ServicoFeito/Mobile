import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import { useResetPassword } from "./useResetPassword";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = criarWrapperQuery();

it("chama resetPasswordForEmail com o deep link", async () => {
  const spy = jest
    .spyOn(supa.auth, "resetPasswordForEmail")
    .mockResolvedValue({ data: {}, error: null });
  const { result } = renderHook(() => useResetPassword(), { wrapper });
  result.current.mutate("a@b.com");
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith("a@b.com", { redirectTo: "servicofeito://auth/redefinir" });
});
