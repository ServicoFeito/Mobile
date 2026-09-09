import { RepoError, type CodigoRepo } from "@/shared/api/repositories";

const TEXTO: Record<CodigoRepo, string> = {
  rede: "Sem conexão. Verifique a internet e tente de novo.",
  nao_autorizado: "Você não tem acesso a isso.",
  nao_encontrado: "Não encontramos o que você procurava.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  conflito: "Isso já existe.",
  validacao: "Dados inválidos. Revise e tente de novo.",
  desconhecido: "Algo deu errado. Tente de novo.",
};

export function traduzErroRepo(e: unknown): string {
  if (e instanceof RepoError) return TEXTO[e.code];
  return TEXTO.desconhecido;
}
