import { categoriasRepositorySupabase } from "./categoriasRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

function mockFrom(resultado: { data: unknown; error: unknown }) {
  const order = jest.fn().mockResolvedValue(resultado);
  const select = jest.fn().mockReturnValue({ order });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);
  return { select, order };
}

it("listar mapeia linha do banco para Categoria (camelCase)", async () => {
  mockFrom({
    data: [
      { id: "c1", nome: "Diarista", descricao: null, icone_key: "broom", popular: true, preco_medio_hora: 50 },
    ],
    error: null,
  });
  const r = await categoriasRepositorySupabase.listar();
  expect(supa.from).toHaveBeenCalledWith("categoria_servico");
  expect(r).toEqual([
    { id: "c1", nome: "Diarista", descricao: null, iconeKey: "broom", popular: true, precoMedioHora: 50 },
  ]);
});

it("listar lança RepoError normalizado quando o supabase retorna error", async () => {
  mockFrom({ data: null, error: { code: "42501", message: "permission denied" } });
  await expect(categoriasRepositorySupabase.listar()).rejects.toBeInstanceOf(RepoError);
  await expect(categoriasRepositorySupabase.listar()).rejects.toMatchObject({ code: "nao_autorizado" });
});
