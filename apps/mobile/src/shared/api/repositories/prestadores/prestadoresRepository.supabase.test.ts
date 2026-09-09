import { prestadoresRepositorySupabase } from "./prestadoresRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

const PP = {
  usuario_id: "p1", nome: "João", cidade: "Floripa", bairro: "Centro", avatar_cor_hex: "#111",
  foto_perfil_url: null, rating_cliente: null, titulo_profissional: "Pintor", bio: "10 anos",
  preco_base: 80, rating: 4.5, total_avaliacoes: 12, total_servicos: 30, verificado: true,
  disponivel: true, raio_km: 15,
};

function chain(resultadoFinal: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "ilike", "order", "range", "in"]) q[m] = jest.fn(() => q);
  q.range = jest.fn().mockResolvedValue(resultadoFinal);
  q.single = jest.fn().mockResolvedValue(resultadoFinal);
  // o builder do supabase-js é thenable: `await` numa cadeia sem terminal
  // (.eq/.order/.in/.ilike) executa a query e resolve {data,error}.
  q.then = jest.fn((resolve: (v: unknown) => unknown) => resolve(resultadoFinal));
  return q;
}

it("listarPorCategoria: join prestador_categoria, order rating desc, range por offset, proximoCursor", async () => {
  // prestador_categoria → ids; perfis_publicos → linhas
  const idsQ = chain({ data: [{ prestador_id: "p1" }, { prestador_id: "p2" }, { prestador_id: "p3" }], error: null });
  // range() pede limite+1 linhas; devolvemos limite+1 p/ a impl detectar "tem mais".
  const ppQ = chain({ data: [PP, { ...PP, usuario_id: "p2" }, { ...PP, usuario_id: "p3" }], error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) =>
    (t === "prestador_categoria" ? idsQ : ppQ) as never,
  );

  const r = await prestadoresRepositorySupabase.listarPorCategoria("c1", {}, { limite: 2 });
  expect(idsQ.eq).toHaveBeenCalledWith("categoria_id", "c1");
  expect(ppQ.order).toHaveBeenCalledWith("rating", { ascending: false });
  expect(ppQ.range).toHaveBeenCalledWith(0, 2); // offset 0 .. limite (pega limite+1)
  expect(r.itens.map((p) => p.usuarioId)).toEqual(["p1", "p2"]);
  expect(r.proximoCursor).toBe("2"); // próximo offset
});

it("listarPorCategoria com cursor '20' → range(20, 22)", async () => {
  const idsQ = chain({ data: [{ prestador_id: "p1" }], error: null });
  const ppQ = chain({ data: [], error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) =>
    (t === "prestador_categoria" ? idsQ : ppQ) as never,
  );
  await prestadoresRepositorySupabase.listarPorCategoria("c1", { cidade: "Floripa" }, { limite: 2, cursor: "20" });
  expect(ppQ.range).toHaveBeenCalledWith(20, 22);
  expect(ppQ.eq).toHaveBeenCalledWith("cidade", "Floripa");
});

it("buscar: ilike em nome, offset, mapeia PrestadorResumo", async () => {
  const ppQ = chain({ data: [PP], error: null });
  jest.spyOn(supa, "from").mockReturnValue(ppQ as never);
  const r = await prestadoresRepositorySupabase.buscar("jo", {}, { limite: 20 });
  expect(supa.from).toHaveBeenCalledWith("perfis_publicos");
  expect(ppQ.ilike).toHaveBeenCalledWith("nome", "%jo%");
  expect(r.itens[0]).toMatchObject({ usuarioId: "p1", nome: "João", tituloProfissional: "Pintor", precoBase: 80 });
  expect(r.proximoCursor).toBeNull();
});

it("obterPerfil agrega perfil + categorias + portfolio + disponibilidade", async () => {
  const ppQ = chain({ data: PP, error: null });
  const pcQ = chain({
    data: [{ categoria_servico: { id: "c1", nome: "Pintor", descricao: null, icone_key: "brush", popular: false, preco_medio_hora: 60 } }],
    error: null,
  });
  const portQ = chain({ data: [{ id: "m1", url_media: "http://x/1.jpg" }], error: null });
  const dispQ = chain({ data: { dom: false, seg: true, ter: true, qua: true, qui: true, sex: true, sab: false }, error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) => {
    if (t === "perfis_publicos") return ppQ as never;
    if (t === "prestador_categoria") return pcQ as never;
    if (t === "portfolio_prestador") return portQ as never;
    return dispQ as never; // disponibilidade_prestador
  });

  const perfil = await prestadoresRepositorySupabase.obterPerfil("p1");
  expect(perfil.usuarioId).toBe("p1");
  expect(perfil.categorias).toEqual([
    { id: "c1", nome: "Pintor", descricao: null, iconeKey: "brush", popular: false, precoMedioHora: 60 },
  ]);
  expect(perfil.portfolio).toEqual([{ id: "m1", urlMedia: "http://x/1.jpg" }]);
  expect(perfil.disponibilidade).toEqual({ dom: false, seg: true, ter: true, qua: true, qui: true, sex: true, sab: false });
});

it("obterPerfil: disponibilidade ausente (PGRST116) vira null, não quebra", async () => {
  const ppQ = chain({ data: PP, error: null });
  const pcQ = chain({ data: [], error: null });
  const portQ = chain({ data: [], error: null });
  const dispQ = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  jest.spyOn(supa, "from").mockImplementation((t: string) => {
    if (t === "perfis_publicos") return ppQ as never;
    if (t === "prestador_categoria") return pcQ as never;
    if (t === "portfolio_prestador") return portQ as never;
    return dispQ as never;
  });
  const perfil = await prestadoresRepositorySupabase.obterPerfil("p1");
  expect(perfil.disponibilidade).toBeNull();
  expect(perfil.categorias).toEqual([]);
  expect(perfil.portfolio).toEqual([]);
});
