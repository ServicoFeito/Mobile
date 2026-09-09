import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import { useSignIn } from "./useSignIn";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = criarWrapperQuery();

it("sucesso chama signInWithPassword com email/senha", async () => {
  const spy = jest
    .spyOn(supa.auth, "signInWithPassword")
    .mockResolvedValue({ data: { session: {} }, error: null });
  const { result } = renderHook(() => useSignIn(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" });
});

it("erro do GoTrue vira mensagem PT", async () => {
  jest
    .spyOn(supa.auth, "signInWithPassword")
    .mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
  const { result } = renderHook(() => useSignIn(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "x" });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as Error).message).toBe("E-mail ou senha incorretos.");
});
