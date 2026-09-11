import { tarefasRepositorySupabase } from "./tarefasRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

afterEach(() => {
  jest.restoreAllMocks();
});

const LINHA = {
  id: "t1",
  demanda_id: "d1",
  nome_tarefa: "Trocar torneira",
  descricao: "Trocar torneira da cozinha",
  concluida: false,
  created_at: "2026-01-01T00:00:00Z",
};
const DOMINIO = {
  id: "t1",
  demandaId: "d1",
  nomeTarefa: "Trocar torneira",
  descricao: "Trocar torneira da cozinha",
  concluida: false,
  createdAt: "2026-01-01T00:00:00Z",
};

it("listarDaDemanda mapeia e ordena por created_at asc", async () => {
  const order = jest.fn().mockResolvedValue({ data: [LINHA], error: null });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);

  const r = await tarefasRepositorySupabase.listarDaDemanda("d1");

  expect(supa.from).toHaveBeenCalledWith("tarefas_demanda");
  expect(eq).toHaveBeenCalledWith("demanda_id", "d1");
  expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
  expect(r).toEqual([DOMINIO]);
});

it("listarDaDemanda lança RepoError normalizado no error do supabase", async () => {
  const order = jest.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);

  await expect(tarefasRepositorySupabase.listarDaDemanda("d1")).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});

it("marcarConcluida chama update({ concluida: true }) com eq(id)", async () => {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ update } as never);

  await tarefasRepositorySupabase.marcarConcluida("t1", true);

  expect(supa.from).toHaveBeenCalledWith("tarefas_demanda");
  expect(update).toHaveBeenCalledWith({ concluida: true });
  expect(eq).toHaveBeenCalledWith("id", "t1");
});

it("marcarConcluida chama update({ concluida: false }) com eq(id)", async () => {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ update } as never);

  await tarefasRepositorySupabase.marcarConcluida("t1", false);

  expect(update).toHaveBeenCalledWith({ concluida: false });
  expect(eq).toHaveBeenCalledWith("id", "t1");
});

it("marcarConcluida com error 42501 (RLS) rejeita nao_autorizado", async () => {
  const eq = jest.fn().mockResolvedValue({ error: { code: "42501" } });
  const update = jest.fn().mockReturnValue({ eq });
  jest.spyOn(supa, "from").mockReturnValue({ update } as never);

  await expect(tarefasRepositorySupabase.marcarConcluida("t1", true)).rejects.toMatchObject({
    code: "nao_autorizado",
  });
});
