import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { traduzErroAuth } from "../types/auth.types";

export function useResetPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "servicofeito://auth/redefinir",
      });
      if (error) throw new Error(traduzErroAuth(error));
    },
  });
}
