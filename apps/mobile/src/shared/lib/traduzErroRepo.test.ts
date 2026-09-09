import { RepoError } from "@/shared/api/repositories";
import { traduzErroRepo } from "./traduzErroRepo";

it("mapeia cada code para uma string PT", () => {
  expect(traduzErroRepo(new RepoError("rede", "x"))).toMatch(/conexão/i);
  expect(traduzErroRepo(new RepoError("nao_autorizado", "x"))).toMatch(/acesso/i);
  expect(traduzErroRepo(new RepoError("nao_encontrado", "x"))).toMatch(/encontr/i);
  expect(traduzErroRepo(new RepoError("nao_autenticado", "x"))).toMatch(/sessão/i);
  expect(traduzErroRepo(new RepoError("conflito", "x"))).toMatch(/já existe/i);
  expect(traduzErroRepo(new RepoError("validacao", "x"))).toMatch(/inválid/i);
  expect(traduzErroRepo(new RepoError("desconhecido", "x"))).toMatch(/errado/i);
});

it("erro que não é RepoError cai no default", () => {
  expect(traduzErroRepo(new Error("boom"))).toMatch(/errado/i);
  expect(traduzErroRepo(null)).toMatch(/errado/i);
});
