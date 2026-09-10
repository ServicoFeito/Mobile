import { propostasRepositorySupabase } from "./propostasRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaProp(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "p1",
    demanda_id: null,
    conversa_id: "c1",
    prestador_id: "pr1",
    cliente_id: "cl1",
    valor: 100,
    taxa_plataforma: 10,
    valor_liquido_prestador: 90,
    descricao: "servico",
    prazo_execucao: null,
    validade_dias: 7,
    status: "ENVIADA",
    created_at: "2026-03-03T00:00:00Z",
    ...over,
  };
}

/** Encadeia select/eq e resolve com `res` no `order` (terminal de lista). */
function chainLista(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq"]) q[m] = jest.fn(() => q);
  q.order = jest.fn().mockResolvedValue(res);
  return q;
}

/** Encadeia select/eq e resolve com `res` no `single`. */
function chainSingle(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq"]) q[m] = jest.fn(() => q);
  q.single = jest.fn().mockResolvedValue(res);
  return q;
}

/** Encadeia insert/select e resolve com `res` no `single`. */
function chainInsert(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["insert", "select"]) q[m] = jest.fn(() => q);
  q.single = jest.fn().mockResolvedValue(res);
  return q;
}

const SELECT_PROP =
  "id, demanda_id, conversa_id, prestador_id, cliente_id, valor, taxa_plataforma, valor_liquido_prestador, descricao, prazo_execucao, validade_dias, status, created_at";

const NOVA = {
  conversaId: "c1",
  demandaId: null,
  clienteId: "cl1",
  prestadorId: "pr1",
  valor: 200,
  descricao: "pintura",
  prazoExecucao: "3 dias",
  validadeDias: 5,
};

afterEach(() => {
  jest.restoreAllMocks();
});

it("daConversa: filtra por conversa_id, ordena asc e mapeia camelCase", async () => {
  const q = chainLista({
    data: [linhaProp({ id: "p1" }), linhaProp({ id: "p2" })],
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await propostasRepositorySupabase.daConversa("c1");
  expect(supa.from).toHaveBeenCalledWith("propostas");
  expect(q.select).toHaveBeenCalledWith(SELECT_PROP);
  expect(q.eq).toHaveBeenCalledWith("conversa_id", "c1");
  expect(q.order).toHaveBeenCalledWith("created_at", { ascending: true });
  expect(r.map((p) => p.id)).toEqual(["p1", "p2"]);
  expect(r[0]?.conversaId).toBe("c1");
  expect(r[0]?.prestadorId).toBe("pr1");
  expect(r[0]?.clienteId).toBe("cl1");
  expect(r[0]?.valor).toBe(100);
  expect(r[0]?.status).toBe("ENVIADA");
});

it("daConversa: coage numericos vindos como string e mantem null", async () => {
  const q = chainLista({
    data: [
      linhaProp({
        valor: "150.50",
        taxa_plataforma: "15.05",
        valor_liquido_prestador: null,
      }),
    ],
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const [p] = await propostasRepositorySupabase.daConversa("c1");
  expect(p?.valor).toBe(150.5);
  expect(typeof p?.valor).toBe("number");
  expect(p?.taxaPlataforma).toBe(15.05);
  expect(p?.valorLiquidoPrestador).toBeNull();
});

it("daConversa: erro na query vira RepoError (nunca PostgrestError cru)", async () => {
  const q = chainLista({ data: null, error: { code: "42501", message: "denied" } });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(
    propostasRepositorySupabase.daConversa("c1"),
  ).rejects.toMatchObject({ code: "nao_autorizado" });
});

it("obter: busca por id com single e devolve a proposta mapeada", async () => {
  const q = chainSingle({ data: linhaProp({ id: "p9", status: "ACEITA" }), error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await propostasRepositorySupabase.obter("p9");
  expect(q.select).toHaveBeenCalledWith(SELECT_PROP);
  expect(q.eq).toHaveBeenCalledWith("id", "p9");
  expect(q.single).toHaveBeenCalled();
  expect(r.id).toBe("p9");
  expect(r.status).toBe("ACEITA");
});

it("obter: PGRST116 (0 linhas) vira nao_encontrado", async () => {
  const q = chainSingle({
    data: null,
    error: { code: "PGRST116", message: "0 rows" },
  });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(propostasRepositorySupabase.obter("x")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});

it("criar: insere SEM status e devolve { id }", async () => {
  const q = chainInsert({ data: { id: "np1" }, error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await propostasRepositorySupabase.criar(NOVA);
  expect(supa.from).toHaveBeenCalledWith("propostas");
  expect(q.insert).toHaveBeenCalledWith({
    conversa_id: "c1",
    demanda_id: null,
    prestador_id: "pr1",
    cliente_id: "cl1",
    valor: 200,
    descricao: "pintura",
    prazo_execucao: "3 dias",
    validade_dias: 5,
  });
  const rowArg = (q.insert.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
  expect(Object.keys(rowArg)).not.toContain("status");
  expect(q.select).toHaveBeenCalledWith("id");
  expect(r).toEqual({ id: "np1" });
});

it("criar: erro do insert vira RepoError", async () => {
  const q = chainInsert({ data: null, error: { code: "23503", message: "fk" } });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(propostasRepositorySupabase.criar(NOVA)).rejects.toMatchObject({
    code: "validacao",
  });
});

it("recusar: chama a RPC fn_recusar_proposta e resolve void", async () => {
  const rpc = jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({ data: null, error: null } as never);

  await expect(propostasRepositorySupabase.recusar("p1")).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledWith("fn_recusar_proposta", { p_proposta_id: "p1" });
});

it("recusar: erro PT404 vira nao_encontrado", async () => {
  jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({ data: null, error: { code: "PT404", message: "sumiu" } } as never);

  await expect(propostasRepositorySupabase.recusar("p1")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});

it("aceitar: chama a RPC fn_aceitar_proposta e devolve { contratacaoId }", async () => {
  const rpc = jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({ data: "contr-1", error: null } as never);

  const r = await propostasRepositorySupabase.aceitar("p1");
  expect(rpc).toHaveBeenCalledWith("fn_aceitar_proposta", { p_proposta_id: "p1" });
  expect(r).toEqual({ contratacaoId: "contr-1" });
});

it("aceitar: erro de negocio PT409 vira conflito", async () => {
  jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({
      data: null,
      error: { code: "PT409", message: "indisponivel" },
    } as never);

  await expect(propostasRepositorySupabase.aceitar("p1")).rejects.toMatchObject({
    code: "conflito",
  });
});

it("aceitar: erro PT401 vira nao_autorizado", async () => {
  jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({
      data: null,
      error: { code: "PT401", message: "nao pode" },
    } as never);

  await expect(propostasRepositorySupabase.aceitar("p1")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});
