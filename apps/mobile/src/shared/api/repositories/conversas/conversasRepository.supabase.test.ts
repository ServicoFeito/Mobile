import { conversasRepositorySupabase } from "./conversasRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaConversa(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1", tipo: "DIRETA", demanda_id: null, cliente_id: "u1", prestador_id: "u2",
    status: "ATIVA", ultima_mensagem: "oi", data_ultima_mensagem: "2026-03-03T00:00:00Z",
    nao_lidas_cliente: 2, nao_lidas_prestador: 0, created_at: "2026-03-01T00:00:00Z", ...over,
  };
}
/** chain select/eq/or/order/in/maybeSingle/single que resolve com `res`. */
function chain(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "or", "order", "in", "insert"]) q[m] = jest.fn(() => q);
  q.order = jest.fn().mockResolvedValue(res);
  q.in = jest.fn().mockResolvedValue(res);
  q.single = jest.fn().mockResolvedValue(res);
  q.maybeSingle = jest.fn().mockResolvedValue(res);
  return q;
}

afterEach(() => {
  jest.restoreAllMocks();
});

it("listarMinhas mapeia naoLidas pelo papel e resolve o outro em perfis_publicos", async () => {
  const conv = chain({ data: [linhaConversa()], error: null });
  const perfis = chain({ data: [{ usuario_id: "u2", nome: "Bia", foto_perfil_url: null }], error: null });
  jest.spyOn(supa, "from").mockImplementation(((t: string) =>
    t === "perfis_publicos" ? perfis : conv) as never);

  const r = await conversasRepositorySupabase.listarMinhas("u1");
  expect(conv.or).toHaveBeenCalledWith("cliente_id.eq.u1,prestador_id.eq.u1");
  expect(conv.order).toHaveBeenCalledWith("data_ultima_mensagem", { ascending: false, nullsFirst: false });
  expect(perfis.in).toHaveBeenCalledWith("usuario_id", ["u2"]);
  expect(r[0]?.naoLidas).toBe(2);          // u1 é cliente
  expect(r[0]?.outroId).toBe("u2");
  expect(r[0]?.outroNome).toBe("Bia");
  expect(r[0]?.tipo).toBe("DIRETA");
});

it("listarMinhas: quando o usuário é o prestador, naoLidas vem de nao_lidas_prestador", async () => {
  const conv = chain({ data: [linhaConversa({ nao_lidas_prestador: 5 })], error: null });
  const perfis = chain({ data: [], error: null });
  jest.spyOn(supa, "from").mockImplementation(((t: string) =>
    t === "perfis_publicos" ? perfis : conv) as never);

  const r = await conversasRepositorySupabase.listarMinhas("u2"); // u2 é prestador
  expect(r[0]?.naoLidas).toBe(5);
  expect(r[0]?.outroId).toBe("u1");
  expect(r[0]?.outroNome).toBeNull();
});

it("listarMinhas: falha na 2ª query (perfis_publicos) não propaga — nomes caem para null", async () => {
  const conv = chain({ data: [linhaConversa()], error: null });
  const perfis = chain({ data: null, error: { code: "42501", message: "denied" } });
  jest.spyOn(supa, "from").mockImplementation(((t: string) =>
    t === "perfis_publicos" ? perfis : conv) as never);

  const r = await conversasRepositorySupabase.listarMinhas("u1");
  expect(r).toHaveLength(1);
  expect(r[0]?.outroNome).toBeNull();
  expect(r[0]?.outroFotoUrl).toBeNull();
});

it("listarMinhas sem linhas não chama perfis_publicos", async () => {
  const conv = chain({ data: [], error: null });
  const fromSpy = jest.spyOn(supa, "from").mockReturnValue(conv as never);
  const r = await conversasRepositorySupabase.listarMinhas("u1");
  expect(r).toEqual([]);
  expect(fromSpy).toHaveBeenCalledTimes(1);
  expect(fromSpy).toHaveBeenCalledWith("conversas");
});

it("listarMinhas propaga erro da 1ª query como RepoError", async () => {
  const conv = chain({ data: null, error: { code: "42501", message: "denied" } });
  jest.spyOn(supa, "from").mockReturnValue(conv as never);
  await expect(conversasRepositorySupabase.listarMinhas("u1")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});

it("obter devolve a conversa e resolve o outro com maybeSingle", async () => {
  const conv = chain({ data: linhaConversa(), error: null });
  const perfil = chain({ data: { usuario_id: "u2", nome: "Bia", foto_perfil_url: "http://x/y.png" }, error: null });
  jest.spyOn(supa, "from").mockImplementation(((t: string) =>
    t === "perfis_publicos" ? perfil : conv) as never);

  const r = await conversasRepositorySupabase.obter("a1", "u1");
  expect(conv.eq).toHaveBeenCalledWith("id", "a1");
  expect(perfil.eq).toHaveBeenCalledWith("usuario_id", "u2");
  expect(r.id).toBe("a1");
  expect(r.outroNome).toBe("Bia");
  expect(r.outroFotoUrl).toBe("http://x/y.png");
});

it("obter em 0 linhas (PGRST116) → RepoError nao_encontrado", async () => {
  const conv = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  jest.spyOn(supa, "from").mockReturnValue(conv as never);
  await expect(conversasRepositorySupabase.obter("x", "u1")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});

it("iniciarDireta acha a conversa existente e não insere", async () => {
  const q = chain({ data: { id: "a9" }, error: null });
  const fromSpy = jest.spyOn(supa, "from").mockReturnValue(q as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "a9" });
  expect(q.insert).not.toHaveBeenCalled();
  fromSpy.mockRestore();
});

it("iniciarDireta insere quando não existe", async () => {
  let call = 0;
  jest.spyOn(supa, "from").mockImplementation((() => {
    call += 1;
    return call === 1
      ? chain({ data: null, error: null })          // achar() -> nada
      : chain({ data: { id: "nova" }, error: null }); // insert().select().single()
  }) as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "nova" });
});

it("iniciarDireta trata corrida (23505) re-selecionando", async () => {
  let call = 0;
  jest.spyOn(supa, "from").mockImplementation((() => {
    call += 1;
    if (call === 1) return chain({ data: null, error: null });
    if (call === 2) return chain({ data: null, error: { code: "23505", message: "dup" } });
    return chain({ data: { id: "venceu" }, error: null });
  }) as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "venceu" });
});

it("iniciarDireta: erro não-conflito no insert propaga como RepoError", async () => {
  let call = 0;
  jest.spyOn(supa, "from").mockImplementation((() => {
    call += 1;
    return call === 1
      ? chain({ data: null, error: null })
      : chain({ data: null, error: { code: "42501", message: "denied" } });
  }) as never);
  await expect(conversasRepositorySupabase.iniciarDireta("u1", "u2")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});

it("iniciarDemanda lê cliente_id da demanda antes do find-or-create", async () => {
  const seq = [
    chain({ data: { cliente_id: "u1" }, error: null }),   // demandas_servico
    chain({ data: { id: "conv-dem" }, error: null }),      // achar()
  ];
  let i = 0;
  jest.spyOn(supa, "from").mockImplementation((() => seq[i++]!) as never);
  const r = await conversasRepositorySupabase.iniciarDemanda("d1", "u2");
  expect(seq[0]!.eq).toHaveBeenCalledWith("id", "d1");
  expect(r).toEqual({ id: "conv-dem" });
});

it("iniciarDemanda: erro ao ler a demanda propaga como RepoError", async () => {
  const seq = [chain({ data: null, error: { code: "PGRST116", message: "0 rows" } })];
  let i = 0;
  jest.spyOn(supa, "from").mockImplementation((() => seq[i++]!) as never);
  await expect(conversasRepositorySupabase.iniciarDemanda("d1", "u2")).rejects.toMatchObject({
    code: "nao_encontrado",
  });
});

it("iniciarDemanda insere com tipo DEMANDA e demanda_id quando não existe", async () => {
  const seq = [
    chain({ data: { cliente_id: "u1" }, error: null }),  // demandas_servico
    chain({ data: null, error: null }),                  // achar() -> nada
    chain({ data: { id: "nova-dem" }, error: null }),    // insert
  ];
  let i = 0;
  jest.spyOn(supa, "from").mockImplementation((() => seq[i++]!) as never);
  const r = await conversasRepositorySupabase.iniciarDemanda("d1", "u2");
  expect(seq[2]!.insert).toHaveBeenCalledWith(
    expect.objectContaining({ tipo: "DEMANDA", demanda_id: "d1", cliente_id: "u1", prestador_id: "u2" }),
  );
  expect(r).toEqual({ id: "nova-dem" });
});
