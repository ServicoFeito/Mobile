import { mensagensRepositorySupabase } from "./mensagensRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaMsg(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m1",
    conversa_id: "a1",
    remetente_id: "u2",
    tipo: "TEXTO",
    corpo: "oi",
    proposta_id: null,
    lida: false,
    created_at: "2026-03-03T00:00:00Z",
    ...over,
  };
}

/** Encadeia select/eq/order/lt e resolve com `res` no `limit`. */
function chainListar(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "order", "lt"]) q[m] = jest.fn(() => q);
  q.limit = jest.fn().mockResolvedValue(res);
  return q;
}

/** Encadeia insert/select e resolve com `res` no `single`. */
function chainInsert(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["insert", "select"]) q[m] = jest.fn(() => q);
  q.single = jest.fn().mockResolvedValue(res);
  return q;
}

/** Par de chains para marcarLidas: `mensagens` (update→eq→eq→neq) e `conversas` (update→eq). */
function chainMarcar(
  resMsg: { error: unknown } = { error: null },
  resConv: { error: unknown } = { error: null },
) {
  const msgU: Record<string, jest.Mock> = {};
  msgU.update = jest.fn(() => msgU);
  msgU.eq = jest.fn(() => msgU);
  msgU.neq = jest.fn().mockResolvedValue(resMsg);
  const convU: Record<string, jest.Mock> = {};
  convU.update = jest.fn(() => convU);
  convU.eq = jest.fn().mockResolvedValue(resConv);
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "conversas" ? convU : msgU)) as never);
  return { msgU, convU };
}

afterEach(() => {
  jest.restoreAllMocks();
});

it("listar: keyset descendente, monta proximoCursor quando vêm limite+1 linhas", async () => {
  const q = chainListar({
    data: [
      linhaMsg({ id: "m1", created_at: "2026-03-03T00:00:00Z" }),
      linhaMsg({ id: "m2", created_at: "2026-03-02T00:00:00Z" }),
      linhaMsg({ id: "m3", created_at: "2026-03-01T00:00:00Z" }),
    ],
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await mensagensRepositorySupabase.listar("a1", { limite: 2 });
  expect(supa.from).toHaveBeenCalledWith("mensagens");
  expect(q.eq).toHaveBeenCalledWith("conversa_id", "a1");
  expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(q.limit).toHaveBeenCalledWith(3); // limite + 1
  expect(q.lt).not.toHaveBeenCalled();
  expect(r.itens.map((m) => m.id)).toEqual(["m1", "m2"]); // extra descartado
  expect(r.itens[0]?.conversaId).toBe("a1");
  expect(r.itens[0]?.remetenteId).toBe("u2");
  expect(r.itens[0]?.lida).toBe(false);
  expect(r.proximoCursor).toBe("2026-03-02T00:00:00Z"); // createdAt do último item retornado
});

it("listar: sem página cheia → proximoCursor null", async () => {
  const q = chainListar({ data: [linhaMsg()], error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await mensagensRepositorySupabase.listar("a1", { limite: 2 });
  expect(r.itens).toHaveLength(1);
  expect(r.proximoCursor).toBeNull();
});

it("listar: aplica .lt(created_at, cursor) só quando há cursor", async () => {
  const q = chainListar({ data: [], error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await mensagensRepositorySupabase.listar("a1", {
    limite: 20,
    cursor: "2026-03-02T00:00:00Z",
  });
  expect(q.lt).toHaveBeenCalledWith("created_at", "2026-03-02T00:00:00Z");
});

it("listar: erro na query vira RepoError (nunca PostgrestError cru)", async () => {
  const q = chainListar({ data: null, error: { code: "42501", message: "denied" } });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(
    mensagensRepositorySupabase.listar("a1", { limite: 2 }),
  ).rejects.toMatchObject({ code: "nao_autorizado" });
});

it("enviarTexto: insere tipo TEXTO + remetente_id do argumento e devolve a linha mapeada", async () => {
  const q = chainInsert({
    data: linhaMsg({ id: "m9", remetente_id: "u1", corpo: "olá" }),
    error: null,
  });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await mensagensRepositorySupabase.enviarTexto("a1", "olá", "u1");
  expect(q.insert).toHaveBeenCalledWith({
    conversa_id: "a1",
    remetente_id: "u1",
    tipo: "TEXTO",
    corpo: "olá",
  });
  expect(q.select).toHaveBeenCalledWith(
    "id, conversa_id, remetente_id, tipo, corpo, proposta_id, lida, created_at",
  );
  expect(r.id).toBe("m9");
  expect(r.remetenteId).toBe("u1");
  expect(r.corpo).toBe("olá");
  expect(r.conversaId).toBe("a1");
  expect(r.tipo).toBe("TEXTO");
});

it("enviarTexto: erro do insert vira RepoError", async () => {
  const q = chainInsert({ data: null, error: { code: "23503", message: "fk" } });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(
    mensagensRepositorySupabase.enviarTexto("a1", "x", "u1"),
  ).rejects.toMatchObject({ code: "validacao" });
});

it("marcarLidas('CLIENTE') zera nao_lidas_cliente e marca as mensagens do outro", async () => {
  const { msgU, convU } = chainMarcar();

  await mensagensRepositorySupabase.marcarLidas("a1", "u1", "CLIENTE");
  expect(supa.from).toHaveBeenCalledWith("mensagens");
  expect(supa.from).toHaveBeenCalledWith("conversas");
  expect(msgU.update).toHaveBeenCalledWith({ lida: true });
  expect(msgU.eq).toHaveBeenCalledWith("conversa_id", "a1");
  expect(msgU.eq).toHaveBeenCalledWith("lida", false);
  expect(msgU.neq).toHaveBeenCalledWith("remetente_id", "u1");
  expect(convU.update).toHaveBeenCalledWith({ nao_lidas_cliente: 0 });
  expect(convU.eq).toHaveBeenCalledWith("id", "a1");
});

it("marcarLidas('PRESTADOR') zera nao_lidas_prestador", async () => {
  const { convU } = chainMarcar();

  await mensagensRepositorySupabase.marcarLidas("a1", "u2", "PRESTADOR");
  expect(convU.update).toHaveBeenCalledWith({ nao_lidas_prestador: 0 });
});

it("marcarLidas: erro na 1ª escrita (mensagens) vira RepoError e não toca em conversas", async () => {
  const { convU } = chainMarcar({ error: { code: "42501", message: "denied" } });

  await expect(
    mensagensRepositorySupabase.marcarLidas("a1", "u1", "CLIENTE"),
  ).rejects.toMatchObject({ code: "nao_autorizado" });
  expect(convU.update).not.toHaveBeenCalled();
});

it("marcarLidas: erro na 2ª escrita (conversas) vira RepoError", async () => {
  chainMarcar({ error: null }, { error: { code: "42501", message: "denied" } });

  await expect(
    mensagensRepositorySupabase.marcarLidas("a1", "u1", "CLIENTE"),
  ).rejects.toMatchObject({ code: "nao_autorizado" });
});
