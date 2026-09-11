import { pagamentosRepositorySupabase } from "./pagamentosRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaPagamento(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pg1",
    contratacao_id: "c1",
    valor: "150.5",
    tipo: "ENTRADA",
    status: "PENDENTE",
    txid: "tx123",
    efi_loc_id: 42,
    pix_copia_cola: "00020126...",
    qr_code_base64: "base64==",
    data_pagamento: null,
    created_at: "2026-03-01T00:00:00Z",
    ...over,
  };
}

/** chain select/eq/in/order/limit que resolve com `res` via single/maybeSingle. */
function chain(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = jest.fn(() => q);
  q.single = jest.fn().mockResolvedValue(res);
  q.maybeSingle = jest.fn().mockResolvedValue(res);
  return q;
}

afterEach(() => {
  jest.restoreAllMocks();
});

it("buscarPendente mapeia todos os campos quando existe", async () => {
  const q = chain({ data: linhaPagamento(), error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await pagamentosRepositorySupabase.buscarPendente("c1");

  expect(supa.from).toHaveBeenCalledWith("pagamentos");
  expect(q.eq).toHaveBeenCalledWith("contratacao_id", "c1");
  expect(q.in).toHaveBeenCalledWith("status", ["PENDENTE", "PROCESSANDO"]);
  expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(q.limit).toHaveBeenCalledWith(1);
  expect(r).toEqual({
    id: "pg1",
    contratacaoId: "c1",
    valor: 150.5,
    tipo: "ENTRADA",
    status: "PENDENTE",
    txid: "tx123",
    efiLocId: 42,
    pixCopiaCola: "00020126...",
    qrCodeBase64: "base64==",
    dataPagamento: null,
    createdAt: "2026-03-01T00:00:00Z",
  });
});

it("buscarPendente sem linha devolve null (não é erro)", async () => {
  const q = chain({ data: null, error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await pagamentosRepositorySupabase.buscarPendente("c1");
  expect(r).toBeNull();
});

it("criarCobranca invoca a edge function e relê a linha atualizada", async () => {
  const invoke = jest.fn().mockResolvedValue({ data: {}, error: null });
  jest.spyOn(supa, "functions", "get").mockReturnValue({ invoke } as never);
  const q = chain({ data: linhaPagamento({ status: "PROCESSANDO" }), error: null });
  const fromSpy = jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await pagamentosRepositorySupabase.criarCobranca("pg1");

  expect(invoke).toHaveBeenCalledWith("criar-cobranca-pix", { body: { pagamento_id: "pg1" } });
  expect(fromSpy).toHaveBeenCalledWith("pagamentos");
  expect(q.eq).toHaveBeenCalledWith("id", "pg1");
  expect(r.status).toBe("PROCESSANDO");
});

it("criarCobranca: erro da function rejeita via normalizarErro", async () => {
  const invoke = jest
    .fn()
    .mockResolvedValue({ data: null, error: { code: "PT409", message: "conflito" } });
  jest.spyOn(supa, "functions", "get").mockReturnValue({ invoke } as never);

  await expect(pagamentosRepositorySupabase.criarCobranca("pg1")).rejects.toMatchObject({
    code: "conflito",
  });
});

it("obterPorId mapeia todos os campos", async () => {
  const q = chain({ data: linhaPagamento({ id: "pg2", status: "PAGO", data_pagamento: "2026-04-01T00:00:00Z" }), error: null });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  const r = await pagamentosRepositorySupabase.obterPorId("pg2");
  expect(q.eq).toHaveBeenCalledWith("id", "pg2");
  expect(r.status).toBe("PAGO");
  expect(r.dataPagamento).toBe("2026-04-01T00:00:00Z");
});

it("obterPorId: erro PGRST116 vira nao_encontrado", async () => {
  const q = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  jest.spyOn(supa, "from").mockReturnValue(q as never);

  await expect(pagamentosRepositorySupabase.obterPorId("pgX")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});
