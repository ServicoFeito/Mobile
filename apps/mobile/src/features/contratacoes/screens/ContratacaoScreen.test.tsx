import { Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import type { Contratacao } from "@/features/contratacoes/types/contratacao.types";
import type { Tarefa } from "@/features/tarefas/types/tarefa.types";
import { RepoError } from "@/shared/api/repositories";

let mockAuthState: { usuarioId: string | null };

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockAuthState),
}));

jest.mock("@/features/contratacoes/hooks/useContratacaoPorProposta", () => ({
  useContratacaoPorProposta: jest.fn(),
}));
jest.mock("@/features/contratacoes/hooks/useCancelarContratacao", () => ({
  useCancelarContratacao: jest.fn(),
}));
jest.mock("@/features/tarefas/hooks/useTarefasDaDemanda", () => ({
  useTarefasDaDemanda: jest.fn(),
}));
jest.mock("@/features/tarefas/hooks/useMarcarTarefaConcluida", () => ({
  useMarcarTarefaConcluida: jest.fn(),
}));

import { useContratacaoPorProposta } from "@/features/contratacoes/hooks/useContratacaoPorProposta";
import { useCancelarContratacao } from "@/features/contratacoes/hooks/useCancelarContratacao";
import { useTarefasDaDemanda } from "@/features/tarefas/hooks/useTarefasDaDemanda";
import { useMarcarTarefaConcluida } from "@/features/tarefas/hooks/useMarcarTarefaConcluida";
import { ContratacaoScreen, erroContratacao } from "./ContratacaoScreen";

const mockUseContratacaoPorProposta = useContratacaoPorProposta as jest.Mock;
const mockUseCancelarContratacao = useCancelarContratacao as jest.Mock;
const mockUseTarefasDaDemanda = useTarefasDaDemanda as jest.Mock;
const mockUseMarcarTarefaConcluida = useMarcarTarefaConcluida as jest.Mock;

const contratacao: Contratacao = {
  id: "ct1",
  demandaId: "d1",
  propostaId: "p1",
  tituloServico: "Pintura de parede",
  clienteId: "c1",
  prestadorId: "pr1",
  valorTotal: 300,
  valorEntrada: null,
  valorFinal: null,
  taxaPlataforma: 60,
  status: "AGUARDANDO_PAGAMENTO",
  entradaPaga: false,
  finalPago: false,
  avaliado: false,
  dataAgendada: null,
  dataConclusao: null,
  outroId: "pr1",
  outroNome: "Bia",
  outroFotoUrl: null,
  createdAt: "2026-03-01T00:00:00Z",
};

const mkTarefa = (o: Partial<Tarefa>): Tarefa => ({
  id: "t1",
  demandaId: "d1",
  nomeTarefa: "Comprar tinta",
  descricao: null,
  concluida: false,
  createdAt: "2026-03-01T00:00:00Z",
  ...o,
});

let cancelarMutate: jest.Mock;
let marcarTarefaMutate: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = { usuarioId: "c1" };
  cancelarMutate = jest.fn();
  marcarTarefaMutate = jest.fn();

  mockUseContratacaoPorProposta.mockReturnValue({
    data: contratacao,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUseCancelarContratacao.mockReturnValue({
    mutate: cancelarMutate,
    isPending: false,
    error: null,
  });
  mockUseTarefasDaDemanda.mockReturnValue({ data: [] });
  mockUseMarcarTarefaConcluida.mockReturnValue({ mutate: marcarTarefaMutate });
});

it("AGUARDANDO_PAGAMENTO: mostra 'Cancelar contratação' e o fluxo de confirmação chama cancelar.mutate(id)", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  const { getByText } = render(<ContratacaoScreen id="p1" />);

  expect(getByText("Cancelar contratação")).toBeTruthy();
  fireEvent.press(getByText("Cancelar contratação"));

  expect(alertSpy).toHaveBeenCalled();
  const botoes = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  const botaoConfirmar = botoes.find((b) => b.text === "Cancelar contratação");
  expect(botaoConfirmar).toBeTruthy();
  botaoConfirmar!.onPress!();

  expect(cancelarMutate).toHaveBeenCalledWith("ct1");
});

it("status AGENDADA: não mostra 'Cancelar contratação'", () => {
  mockUseContratacaoPorProposta.mockReturnValue({
    data: { ...contratacao, status: "AGENDADA" },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });

  const { queryByText } = render(<ContratacaoScreen id="p1" />);

  expect(queryByText("Cancelar contratação")).toBeNull();
});

it("cliente pode marcar tarefa: press no checkbox chama marcarTarefa.mutate com concluida invertida", () => {
  mockAuthState = { usuarioId: "c1" }; // = contratacao.clienteId
  mockUseTarefasDaDemanda.mockReturnValue({ data: [mkTarefa({ id: "t1", concluida: false })] });

  const { getByText } = render(<ContratacaoScreen id="p1" />);

  fireEvent.press(getByText("Comprar tinta"));

  expect(marcarTarefaMutate).toHaveBeenCalledWith({ tarefaId: "t1", concluida: true });
});

it("prestador não pode marcar tarefa: press no checkbox não chama marcarTarefa.mutate", () => {
  mockAuthState = { usuarioId: "pr1" }; // = contratacao.prestadorId
  mockUseTarefasDaDemanda.mockReturnValue({ data: [mkTarefa({ id: "t1", concluida: false })] });

  const { getByText } = render(<ContratacaoScreen id="p1" />);

  fireEvent.press(getByText("Comprar tinta"));

  expect(marcarTarefaMutate).not.toHaveBeenCalled();
});

it("demanda sem tarefas visiveis (RLS): nao mostra a secao 'Tarefas'", () => {
  mockUseTarefasDaDemanda.mockReturnValue({ data: [] });

  const { queryByText } = render(<ContratacaoScreen id="p1" />);

  expect(queryByText("Tarefas")).toBeNull();
});

it("erro de cancelamento (conflito) mostra a mensagem traduzida", () => {
  mockUseCancelarContratacao.mockReturnValue({
    mutate: cancelarMutate,
    isPending: false,
    error: new RepoError("conflito", "x"),
  });

  const { getByText } = render(<ContratacaoScreen id="p1" />);

  expect(getByText("Esta contratação não pode mais ser cancelada.")).toBeTruthy();
});

describe("erroContratacao", () => {
  it("null quando sem erro", () => expect(erroContratacao(null)).toBeNull());
  it.each([
    ["nao_autorizado", "Você não pode cancelar esta contratação."],
    ["conflito", "Esta contratação não pode mais ser cancelada."],
    ["nao_encontrado", "Contratação não encontrada."],
  ] as const)("mapeia RepoError %s", (code, msg) =>
    expect(erroContratacao(new RepoError(code as never, "x"))).toBe(msg));
  it("generico p/ não-RepoError", () =>
    expect(erroContratacao(new Error("x"))).toBe("Não foi possível concluir. Tente de novo."));
});
