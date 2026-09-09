export type CodigoRepo =
  | "nao_autenticado"
  | "nao_autorizado"
  | "nao_encontrado"
  | "conflito"
  | "validacao"
  | "rede"
  | "desconhecido";

export class RepoError extends Error {
  code: CodigoRepo;
  cause?: unknown;
  constructor(code: CodigoRepo, message: string, cause?: unknown) {
    super(message);
    this.name = "RepoError";
    this.code = code;
    this.cause = cause;
  }
}

export interface PageParams {
  limite: number;
  cursor?: string;
}

export interface Pagina<T> {
  itens: T[];
  proximoCursor: string | null;
}

const MENSAGEM: Record<CodigoRepo, string> = {
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  nao_autorizado: "Você não tem acesso a isso.",
  nao_encontrado: "Não encontramos o que você procurava.",
  conflito: "Isso já existe.",
  validacao: "Dados inválidos. Revise e tente de novo.",
  rede: "Sem conexão. Verifique a internet e tente de novo.",
  desconhecido: "Algo deu errado. Tente de novo.",
};

function classificar(e: unknown): CodigoRepo {
  if (e instanceof TypeError && /network request failed|failed to fetch/i.test(e.message)) {
    return "rede";
  }
  if (typeof e === "object" && e !== null) {
    const obj = e as { code?: unknown; status?: unknown; message?: unknown };
    if (obj.status === 401) return "nao_autenticado";
    const code = typeof obj.code === "string" ? obj.code : "";
    if (code === "PGRST116") return "nao_encontrado";
    if (code === "42501") return "nao_autorizado";
    if (code === "23505") return "conflito";
    if (code.startsWith("23")) return "validacao";
    if (typeof obj.message === "string" && /jwt|not authenticated|auth session missing/i.test(obj.message)) {
      return "nao_autenticado";
    }
  }
  return "desconhecido";
}

export function normalizarErro(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  const code = classificar(e);
  return new RepoError(code, MENSAGEM[code], e);
}
