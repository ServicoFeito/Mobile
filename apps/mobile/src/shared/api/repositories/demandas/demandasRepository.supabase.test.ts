import { demandasRepositorySupabase } from "./demandasRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

function linha(id: string, createdAt: string) {
  return {
    id, titulo: "Pintar sala", descricao: "2 paredes", categoria_id: "c1",
    categoria_servico: { nome: "Pintor" }, endereco_cidade: "Floripa", endereco_bairro: "Centro",
    endereco_completo: "Rua A, 10", orcamento_maximo: 500, data_desejada: null, urgencia: "Normal",
    status: "ABERTA", total_propostas: 0, created_at: createdAt,
    perfis_publicos: { nome: "Ana" },
  };
}

/** Encadeia os métodos do query builder que a impl usa e resolve com `resultado`. */
function mockQuery(resultado: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  const chain = () => q;
  for (const m of ["select", "eq", "ilike", "order", "lt", "limit"]) {
    q[m] = jest.fn(chain);
  }
  q.limit = jest.fn().mockResolvedValue(resultado);
  q.single = jest.fn().mockResolvedValue(resultado);
  q.maybeSingle = jest.fn().mockResolvedValue(resultado);
  jest.spyOn(supa, "from").mockReturnValue(q as never);
  return q;
}

/** Chain de uma query só (select/eq → single|maybeSingle). */
function mkChain(resultado: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq"]) q[m] = jest.fn(() => q);
  q.single = jest.fn().mockResolvedValue(resultado);
  q.maybeSingle = jest.fn().mockResolvedValue(resultado);
  return q;
}

it("listarAbertas mapeia linhas + categoriaNome do join e monta proximoCursor quando há página cheia", async () => {
  const q = mockQuery({
    data: [linha("d1", "2026-03-03T00:00:00Z"), linha("d2", "2026-03-02T00:00:00Z"), linha("d3", "2026-03-01T00:00:00Z")],
    error: null,
  });
  const r = await demandasRepositorySupabase.listarAbertas({}, { limite: 2 });
  expect(supa.from).toHaveBeenCalledWith("demandas_servico");
  expect(q.eq).toHaveBeenCalledWith("status", "ABERTA");
  expect(q.limit).toHaveBeenCalledWith(3); // limite + 1
  expect(r.itens.map((d) => d.id)).toEqual(["d1", "d2"]); // extra descartado
  expect(r.itens[0]?.categoriaNome).toBe("Pintor");
  expect(r.proximoCursor).toBe("2026-03-02T00:00:00Z"); // created_at do último item retornado
});

it("listarAbertas sem página cheia → proximoCursor null", async () => {
  mockQuery({ data: [linha("d1", "2026-03-03T00:00:00Z")], error: null });
  const r = await demandasRepositorySupabase.listarAbertas({}, { limite: 2 });
  expect(r.itens).toHaveLength(1);
  expect(r.proximoCursor).toBeNull();
});

it("listarAbertas aplica cursor (lt created_at), filtro de cidade e termo", async () => {
  const q = mockQuery({ data: [], error: null });
  await demandasRepositorySupabase.listarAbertas(
    { cidade: "Floripa", termo: "pint", categoriaId: "c1" },
    { limite: 20, cursor: "2026-03-02T00:00:00Z" },
  );
  expect(q.lt).toHaveBeenCalledWith("created_at", "2026-03-02T00:00:00Z");
  expect(q.eq).toHaveBeenCalledWith("endereco_cidade", "Floripa");
  expect(q.eq).toHaveBeenCalledWith("categoria_id", "c1");
  expect(q.ilike).toHaveBeenCalledWith("titulo", "%pint%");
});

it("obter devolve DemandaDetalhe; clienteNome vem de 2ª query em perfis_publicos", async () => {
  const dem = mkChain({
    data: { ...linha("d1", "2026-03-03T00:00:00Z"), cliente_id: "u9" },
    error: null,
  });
  const cli = mkChain({ data: { nome: "Ana" }, error: null });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? cli : dem)) as never);
  const d = await demandasRepositorySupabase.obter("d1");
  expect(dem.eq).toHaveBeenCalledWith("id", "d1");
  expect(cli.eq).toHaveBeenCalledWith("usuario_id", "u9");
  expect(d.clienteNome).toBe("Ana");
  expect(d.enderecoCompleto).toBe("Rua A, 10");
});

it("obter: 2ª query sem cliente → clienteNome null, não quebra", async () => {
  const dem = mkChain({
    data: { ...linha("d1", "2026-03-03T00:00:00Z"), cliente_id: "u9" },
    error: null,
  });
  const cli = mkChain({ data: null, error: null });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? cli : dem)) as never);
  const d = await demandasRepositorySupabase.obter("d1");
  expect(d.clienteNome).toBeNull();
});

it("obter em 0 linhas (PGRST116) → RepoError nao_encontrado", async () => {
  mockQuery({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  await expect(demandasRepositorySupabase.obter("x")).rejects.toMatchObject({ code: "nao_encontrado" });
});

it("criar insere row (status default do banco) e devolve { id }", async () => {
  const single = jest.fn().mockResolvedValue({ data: { id: "novo" }, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  const r = await demandasRepositorySupabase.criar({
    clienteId: "u1", categoriaId: "c1", titulo: "Pintar", descricao: "sala",
    orcamentoMaximo: 500, urgencia: "Normal", enderecoCidade: "Floripa",
    enderecoBairro: "Centro", enderecoCompleto: "Rua A, 10", dataDesejada: null,
  });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ cliente_id: "u1", categoria_id: "c1", titulo: "Pintar" }),
  );
  expect(insert.mock.calls[0]?.[0]).not.toHaveProperty("status"); // deixa o default 'ABERTA' do banco
  expect(r).toEqual({ id: "novo" });
});

it("RepoError é instância de Error", () => {
  expect(new RepoError("rede", "x")).toBeInstanceOf(Error);
});
