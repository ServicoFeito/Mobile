import { enderecosRepositorySupabase } from "./enderecosRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

const LINHA = {
  id: "e1", usuario_id: "u1", identificacao: "Casa", cep: "88000-000", estado: "SC",
  cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10",
  complemento: "ap 2", principal: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const DOMINIO = {
  id: "e1", identificacao: "Casa", cep: "88000-000", estado: "SC", cidade: "Floripa",
  bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: "ap 2", principal: true,
};

it("listarMeus mapeia e ordena por created_at desc", async () => {
  const order = jest.fn().mockResolvedValue({ data: [LINHA], error: null });
  const select = jest.fn().mockReturnValue({ order });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);

  const r = await enderecosRepositorySupabase.listarMeus();
  expect(supa.from).toHaveBeenCalledWith("enderecos_usuario");
  expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(r).toEqual([DOMINIO]);
});

it("criar faz insert do row montado e devolve o Endereco", async () => {
  const single = jest.fn().mockResolvedValue({ data: LINHA, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  const r = await enderecosRepositorySupabase.criar({
    usuarioId: "u1", identificacao: "Casa", cep: "88000-000", estado: "SC", cidade: "Floripa",
    bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: "ap 2", principal: true,
  });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ usuario_id: "u1", identificacao: "Casa", cidade: "Floripa" }),
  );
  expect(r).toEqual(DOMINIO);
});

it("criar lança RepoError normalizado no error do supabase", async () => {
  const single = jest.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "dup" } });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  await expect(
    enderecosRepositorySupabase.criar({
      usuarioId: "u1", identificacao: null, cep: null, estado: null, cidade: "x", bairro: null,
      logradouro: null, numero: null, complemento: null, principal: false,
    }),
  ).rejects.toMatchObject({ code: "conflito" });
  await expect(enderecosRepositorySupabase.criar as never).toBeInstanceOf(Function);
  expect(new RepoError("rede", "x")).toBeInstanceOf(RepoError);
});
