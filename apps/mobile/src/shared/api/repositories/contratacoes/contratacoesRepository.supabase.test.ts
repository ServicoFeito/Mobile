import { contratacoesRepositorySupabase } from "./contratacoesRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaContratacao(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    demanda_id: "d1",
    proposta_id: "p1",
    titulo_servico: "Pintura",
    cliente_id: "u1",
    prestador_id: "u2",
    valor_total: "150.5",
    valor_entrada: "50",
    valor_final: "100.5",
    taxa_plataforma: "10",
    status: "AGENDADA",
    entrada_paga: true,
    final_pago: false,
    avaliado: false,
    data_agendada: "2026-04-01T00:00:00Z",
    data_conclusao: null,
    created_at: "2026-03-01T00:00:00Z",
    ...over,
  };
}

/** chain select/eq/or/order/in que resolve com `res`. */
function chain(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "or", "order", "in"]) q[m] = jest.fn(() => q);
  q.order = jest.fn().mockResolvedValue(res);
  q.in = jest.fn().mockResolvedValue(res);
  q.single = jest.fn().mockResolvedValue(res);
  q.maybeSingle = jest.fn().mockResolvedValue(res);
  return q;
}

afterEach(() => {
  jest.restoreAllMocks();
});

it("obterPorProposta mapeia todos os campos (coerção numérica) e resolve outroNome", async () => {
  const contr = chain({ data: linhaContratacao(), error: null });
  const perfil = chain({
    data: { usuario_id: "u2", nome: "Bia", foto_perfil_url: "http://x/y.png" },
    error: null,
  });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfil : contr)) as never);

  const r = await contratacoesRepositorySupabase.obterPorProposta("p1", "u1");
  expect(contr.eq).toHaveBeenCalledWith("proposta_id", "p1");
  expect(perfil.eq).toHaveBeenCalledWith("usuario_id", "u2");
  expect(r).toEqual({
    id: "c1",
    demandaId: "d1",
    propostaId: "p1",
    tituloServico: "Pintura",
    clienteId: "u1",
    prestadorId: "u2",
    valorTotal: 150.5,
    valorEntrada: 50,
    valorFinal: 100.5,
    taxaPlataforma: 10,
    status: "AGENDADA",
    entradaPaga: true,
    finalPago: false,
    avaliado: false,
    dataAgendada: "2026-04-01T00:00:00Z",
    dataConclusao: null,
    outroId: "u2",
    outroNome: "Bia",
    outroFotoUrl: "http://x/y.png",
    createdAt: "2026-03-01T00:00:00Z",
  });
});

it("obterPorProposta: usuário prestador → outroId é o cliente", async () => {
  const contr = chain({ data: linhaContratacao(), error: null });
  const perfil = chain({ data: { usuario_id: "u1", nome: "Ana", foto_perfil_url: null }, error: null });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfil : contr)) as never);

  const r = await contratacoesRepositorySupabase.obterPorProposta("p1", "u2");
  expect(perfil.eq).toHaveBeenCalledWith("usuario_id", "u1");
  expect(r.outroId).toBe("u1");
  expect(r.outroNome).toBe("Ana");
});

it("obterPorProposta: valores nuláveis (entrada/final/taxa null) preservados como null", async () => {
  const contr = chain({
    data: linhaContratacao({ valor_entrada: null, valor_final: null, taxa_plataforma: null }),
    error: null,
  });
  const perfil = chain({ data: null, error: null });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfil : contr)) as never);

  const r = await contratacoesRepositorySupabase.obterPorProposta("p1", "u1");
  expect(r.valorEntrada).toBeNull();
  expect(r.valorFinal).toBeNull();
  expect(r.taxaPlataforma).toBeNull();
});

it("obterPorProposta: valor_total null cai para 0", async () => {
  const contr = chain({ data: linhaContratacao({ valor_total: null }), error: null });
  const perfil = chain({ data: null, error: null });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfil : contr)) as never);

  const r = await contratacoesRepositorySupabase.obterPorProposta("p1", "u1");
  expect(r.valorTotal).toBe(0);
});

it("obterPorProposta: falha na 2ª query (perfis_publicos) não propaga — outroNome null", async () => {
  const contr = chain({ data: linhaContratacao(), error: null });
  const perfil = chain({ data: null, error: { code: "42501", message: "denied" } });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfil : contr)) as never);

  const r = await contratacoesRepositorySupabase.obterPorProposta("p1", "u1");
  expect(r.outroNome).toBeNull();
  expect(r.outroFotoUrl).toBeNull();
});

it("obterPorProposta em 0 linhas (PGRST116) → RepoError nao_encontrado", async () => {
  const contr = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  jest.spyOn(supa, "from").mockReturnValue(contr as never);
  await expect(contratacoesRepositorySupabase.obterPorProposta("p1", "u1")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});

it("listarMinhas filtra por cliente/prestador, ordena por created_at desc e mapeia outroId por papel", async () => {
  const linhas = [
    linhaContratacao({ id: "c1", cliente_id: "u1", prestador_id: "u2" }),
    linhaContratacao({ id: "c2", cliente_id: "u3", prestador_id: "u1" }),
  ];
  const contr = chain({ data: linhas, error: null });
  const perfis = chain({
    data: [
      { usuario_id: "u2", nome: "Bia", foto_perfil_url: null },
      { usuario_id: "u3", nome: "Caio", foto_perfil_url: null },
    ],
    error: null,
  });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfis : contr)) as never);

  const r = await contratacoesRepositorySupabase.listarMinhas("u1");
  expect(contr.or).toHaveBeenCalledWith("cliente_id.eq.u1,prestador_id.eq.u1");
  expect(contr.order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(perfis.in).toHaveBeenCalledWith("usuario_id", ["u2", "u3"]);
  expect(r).toHaveLength(2);
  expect(r[0]?.id).toBe("c1");
  expect(r[0]?.outroId).toBe("u2"); // u1 é cliente em c1 -> outro é o prestador
  expect(r[0]?.outroNome).toBe("Bia");
  expect(r[1]?.id).toBe("c2");
  expect(r[1]?.outroId).toBe("u3"); // u1 é prestador em c2 -> outro é o cliente
  expect(r[1]?.outroNome).toBe("Caio");
});

it("listarMinhas sem linhas não chama perfis_publicos", async () => {
  const contr = chain({ data: [], error: null });
  const fromSpy = jest.spyOn(supa, "from").mockReturnValue(contr as never);
  const r = await contratacoesRepositorySupabase.listarMinhas("u1");
  expect(r).toEqual([]);
  expect(fromSpy).toHaveBeenCalledTimes(1);
  expect(fromSpy).toHaveBeenCalledWith("contratacoes");
});

it("listarMinhas: falha na 2ª query (perfis_publicos) não propaga — nomes caem para null", async () => {
  const contr = chain({ data: [linhaContratacao()], error: null });
  const perfis = chain({ data: null, error: { code: "42501", message: "denied" } });
  jest
    .spyOn(supa, "from")
    .mockImplementation(((t: string) => (t === "perfis_publicos" ? perfis : contr)) as never);

  const r = await contratacoesRepositorySupabase.listarMinhas("u1");
  expect(r).toHaveLength(1);
  expect(r[0]?.outroNome).toBeNull();
  expect(r[0]?.outroFotoUrl).toBeNull();
});

it("listarMinhas propaga erro da 1ª query como RepoError", async () => {
  const contr = chain({ data: null, error: { code: "42501", message: "denied" } });
  jest.spyOn(supa, "from").mockReturnValue(contr as never);
  await expect(contratacoesRepositorySupabase.listarMinhas("u1")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});

it("cancelar: chama a RPC fn_cancelar_contratacao e resolve void", async () => {
  const rpc = jest.spyOn(supa, "rpc").mockResolvedValue({ data: null, error: null } as never);

  await expect(contratacoesRepositorySupabase.cancelar("c1")).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledWith("fn_cancelar_contratacao", { p_contratacao_id: "c1" });
});

it("cancelar: erro PT409 vira conflito", async () => {
  jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({ data: null, error: { code: "PT409", message: "indisponivel" } } as never);

  await expect(contratacoesRepositorySupabase.cancelar("c1")).rejects.toMatchObject({
    code: "conflito",
  });
});

it("cancelar: erro PT401 vira nao_autorizado", async () => {
  jest
    .spyOn(supa, "rpc")
    .mockResolvedValue({ data: null, error: { code: "PT401", message: "nao pode" } } as never);

  await expect(contratacoesRepositorySupabase.cancelar("c1")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});
