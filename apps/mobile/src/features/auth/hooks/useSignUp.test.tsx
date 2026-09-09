import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";
import { useSignUp } from "./useSignUp";

const supa = require("@/shared/api/supabaseClient").supabase;
const wrapper = criarWrapperQuery();

it("sucesso chama signUp com email/password", async () => {
  const spy = jest.spyOn(supa.auth, "signUp").mockResolvedValue({ data: {}, error: null });
  const { result } = renderHook(() => useSignUp(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(spy).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" });
});

it("e-mail já cadastrado vira mensagem PT", async () => {
  jest
    .spyOn(supa.auth, "signUp")
    .mockResolvedValue({ data: {}, error: { message: "User already registered" } });
  const { result } = renderHook(() => useSignUp(), { wrapper });
  result.current.mutate({ email: "a@b.com", senha: "secret1" });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as Error).message).toBe("E-mail já cadastrado.");
});
