export interface CredenciaisLogin {
  email: string;
  senha: string;
}

export function traduzErroAuth(erro: unknown): string {
  const msg =
    erro instanceof Error
      ? erro.message
      : typeof erro === "object" && erro !== null && "message" in erro
        ? String((erro as { message: unknown }).message)
        : String(erro ?? "");
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered|already been registered/i.test(msg)) return "E-mail já cadastrado.";
  if (/rate limit|over_email_send/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/unable to validate email|invalid format/i.test(msg)) return "E-mail inválido.";
  return "Não foi possível concluir. Tente de novo.";
}
