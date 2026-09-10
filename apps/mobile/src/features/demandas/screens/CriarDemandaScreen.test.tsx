import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    categorias: { listar: jest.fn().mockResolvedValue([{ id: "c1", nome: "Pintor", descricao: null, iconeKey: "b", popular: false, precoMedioHora: 0 }]) },
    enderecos: { listarMeus: jest.fn().mockResolvedValue([{ id: "e1", identificacao: "Casa", cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: null, cep: null, estado: null, principal: false }]), criar: jest.fn() },
    demandas: { criar: jest.fn().mockResolvedValue({ id: "d9" }) },
  },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { CriarDemandaScreen } from "./CriarDemandaScreen";

const Wrapper = criarWrapperQuery();

it("botão desabilitado até categoria + título + descrição + endereço", async () => {
  const { getByText, getByPlaceholderText } = render(<CriarDemandaScreen />, { wrapper: Wrapper });
  await waitFor(() => getByText("Pintor"));
  // nada preenchido → Botao mostra o título mas onPress não chama o repo
  fireEvent.press(getByText("Publicar demanda"));
  expect(repositories.demandas.criar).not.toHaveBeenCalled();

  fireEvent.press(getByText("Pintor"));
  fireEvent.changeText(getByPlaceholderText(/Título/), "Pintar sala");
  fireEvent.changeText(getByPlaceholderText(/Descreva/), "2 paredes");
  await waitFor(() => getByText(/Casa/));
  fireEvent.press(getByText(/Casa/));

  fireEvent.press(getByText("Publicar demanda"));
  await waitFor(() =>
    expect(repositories.demandas.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: "u1",
        categoriaId: "c1",
        titulo: "Pintar sala",
        descricao: "2 paredes",
        enderecoCidade: "Floripa",
      }),
    ),
  );
  expect(mockReplace).toHaveBeenCalledWith("/(app)/demanda/d9");
});
