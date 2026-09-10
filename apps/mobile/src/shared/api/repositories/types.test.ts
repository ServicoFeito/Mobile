import { RepoError, normalizarErro } from "./types";

describe("normalizarErro", () => {
  it("PGRST116 (0 linhas) → nao_encontrado", () => {
    const e = normalizarErro({ code: "PGRST116", message: "Results contain 0 rows" });
    expect(e).toBeInstanceOf(RepoError);
    expect(e.code).toBe("nao_encontrado");
  });

  it("23505 (unique) → conflito", () => {
    expect(normalizarErro({ code: "23505", message: "duplicate key" }).code).toBe("conflito");
  });

  it("outras constraints 23xxx → validacao", () => {
    expect(normalizarErro({ code: "23503", message: "fk violation" }).code).toBe("validacao");
  });

  it("42501 (RLS/privilege) → nao_autorizado", () => {
    expect(normalizarErro({ code: "42501", message: "permission denied" }).code).toBe("nao_autorizado");
  });

  it("status 401 → nao_autenticado", () => {
    expect(normalizarErro({ status: 401, message: "JWT expired" }).code).toBe("nao_autenticado");
  });

  it("TypeError de fetch → rede", () => {
    expect(normalizarErro(new TypeError("Network request failed")).code).toBe("rede");
  });

  it("desconhecido por padrão", () => {
    expect(normalizarErro({ foo: 1 }).code).toBe("desconhecido");
    expect(normalizarErro("qualquer coisa").code).toBe("desconhecido");
  });

  it("preserva o original em cause e não vaza a mensagem crua", () => {
    const orig = { code: "23505", message: "duplicate key value violates unique constraint \"x\"" };
    const e = normalizarErro(orig);
    expect(e.cause).toBe(orig);
    expect(e.message).not.toContain("unique constraint");
  });

  it("um RepoError passa reto (idempotente)", () => {
    const e = new RepoError("rede", "Sem conexão.");
    expect(normalizarErro(e)).toBe(e);
  });

  it.each([
    ["PT401", "nao_autorizado"],
    ["PT404", "nao_encontrado"],
    ["PT409", "conflito"],
  ] as const)("mapeia SQLSTATE de negocio %s -> %s", (code, esperado) => {
    expect(normalizarErro({ code, message: "erro plpgsql" }).code).toBe(esperado);
  });
});
