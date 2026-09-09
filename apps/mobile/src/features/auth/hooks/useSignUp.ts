import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { traduzErroAuth, type CredenciaisLogin } from "../types/auth.types";

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, senha }: CredenciaisLogin) => {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) throw new Error(traduzErroAuth(error));
    },
  });
}
