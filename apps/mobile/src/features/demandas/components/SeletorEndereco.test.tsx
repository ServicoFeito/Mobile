import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { enderecos: { listarMeus: jest.fn(), criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { SeletorEndereco } from "./SeletorEndereco";

const Wrapper = criarWrapperQuery();
const renderCom = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper });

it("lista os endereços e seleciona ao tocar", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([
    { id: "e1", identificacao: "Casa", cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: null, cep: null, estado: null, principal: false },
  ]);
  const onSelecionar = jest.fn();
  const { getByText } = renderCom(<SeletorEndereco enderecoSelecionado={null} onSelecionar={onSelecionar} />);
  await waitFor(() => getByText(/Casa/));
  fireEvent.press(getByText(/Casa/));
  expect(onSelecionar).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
});

it("'adicionar novo' mostra o FormEndereco; ao criar, seleciona o novo", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([]);
  (repositories.enderecos.criar as jest.Mock).mockResolvedValue({ id: "e9", identificacao: "Novo", cidade: "Floripa", bairro: null, logradouro: null, numero: null, complemento: null, cep: null, estado: null, principal: false });
  const onSelecionar = jest.fn();
  const { getByText, getByPlaceholderText } = renderCom(<SeletorEndereco enderecoSelecionado={null} onSelecionar={onSelecionar} />);
  await waitFor(() => getByText(/Adicionar endereço/i));
  fireEvent.press(getByText(/Adicionar endereço/i));
  fireEvent.changeText(getByPlaceholderText(/Cidade/), "Floripa");
  fireEvent.press(getByText(/Salvar endereço/i));
  await waitFor(() => expect(onSelecionar).toHaveBeenCalledWith(expect.objectContaining({ id: "e9" })));
});
