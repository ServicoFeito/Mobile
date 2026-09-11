import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    tarefas: { listarDaDemanda: jest.fn(), marcarConcluida: jest.fn() },
  },
}));

jest.mock("@/shared/query/queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useTarefasDaDemanda } from "./useTarefasDaDemanda";
import { useMarcarTarefaConcluida } from "./useMarcarTarefaConcluida";

let wrapper: ReturnType<typeof criarWrapperQuery>;

beforeEach(() => {
  jest.clearAllMocks();
  wrapper = criarWrapperQuery();
});

it("useTarefasDaDemanda busca as tarefas da demanda", async () => {
  (repositories.tarefas.listarDaDemanda as jest.Mock).mockResolvedValue([{ id: "t1" }]);
  const { result } = renderHook(() => useTarefasDaDemanda("d1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.tarefas.listarDaDemanda).toHaveBeenCalledWith("d1");
  expect(result.current.data).toEqual([{ id: "t1" }]);
});

it("useTarefasDaDemanda com demandaId vazio fica idle e não chama o repositório", async () => {
  const { result } = renderHook(() => useTarefasDaDemanda(""), { wrapper });
  await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
  expect(repositories.tarefas.listarDaDemanda).not.toHaveBeenCalled();
});

it("useMarcarTarefaConcluida marca como concluída e invalida a query da demanda", async () => {
  (repositories.tarefas.marcarConcluida as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useMarcarTarefaConcluida("d1"), { wrapper });

  result.current.mutate({ tarefaId: "t1", concluida: true });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.tarefas.marcarConcluida).toHaveBeenCalledWith("t1", true);
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["tarefas", "demanda", "d1"],
  });
});

it("useMarcarTarefaConcluida desmarca (concluida: false) e invalida a query da demanda", async () => {
  (repositories.tarefas.marcarConcluida as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(() => useMarcarTarefaConcluida("d1"), { wrapper });

  result.current.mutate({ tarefaId: "t1", concluida: false });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.tarefas.marcarConcluida).toHaveBeenCalledWith("t1", false);
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["tarefas", "demanda", "d1"],
  });
});
