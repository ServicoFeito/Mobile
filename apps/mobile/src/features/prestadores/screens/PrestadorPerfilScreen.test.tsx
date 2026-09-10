import { render, fireEvent, waitFor } from "@testing-library/react-native";
import type { PrestadorPerfil } from "@/features/prestadores/types/prestador.types";

jest.mock("@/features/prestadores/hooks/usePrestadorPerfil", () => ({
  usePrestadorPerfil: jest.fn(),
}));
jest.mock("@/features/conversas/hooks/useIniciarConversa", () => ({
  useIniciarConversa: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

let mockUsuarioId: string | null = "cliente-1";
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string | null }) => unknown) => sel({ usuarioId: mockUsuarioId }),
}));

import { router } from "expo-router";
import { usePrestadorPerfil } from "@/features/prestadores/hooks/usePrestadorPerfil";
import { useIniciarConversa } from "@/features/conversas/hooks/useIniciarConversa";
import { PrestadorPerfilScreen } from "./PrestadorPerfilScreen";

const perfil: PrestadorPerfil = {
  usuarioId: "prest-9",
  nome: "João",
  cidade: "Florianópolis",
  bairro: "Centro",
  tituloProfissional: "Pintor",
  precoBase: 120,
  rating: 4.8,
  totalAvaliacoes: 12,
  verificado: true,
  disponivel: true,
  fotoPerfilUrl: null,
  avatarCorHex: null,
  bio: "Trabalho com pintura residencial.",
  raioKm: 10,
  totalServicos: 30,
  categorias: [],
  portfolio: [],
  disponibilidade: null,
};

const iniciarDireta = jest.fn().mockResolvedValue({ id: "conv-1" });

beforeEach(() => {
  jest.clearAllMocks();
  mockUsuarioId = "cliente-1";
  iniciarDireta.mockResolvedValue({ id: "conv-1" });
  (usePrestadorPerfil as jest.Mock).mockReturnValue({ isLoading: false, isError: false, data: perfil });
  (useIniciarConversa as jest.Mock).mockReturnValue({
    iniciarDireta,
    iniciarDemanda: jest.fn(),
    pendente: false,
  });
});

it("mostra 'Conversar' e inicia conversa direta ao ver outro prestador", async () => {
  const { getByText } = render(<PrestadorPerfilScreen usuarioId="prest-9" />);
  fireEvent.press(getByText("Conversar"));
  await waitFor(() => expect(iniciarDireta).toHaveBeenCalledWith("prest-9"));
  expect(router.push).toHaveBeenCalledWith("/conversa/conv-1");
});

it("não mostra 'Conversar' ao ver o próprio perfil", () => {
  mockUsuarioId = "prest-9";
  const { queryByText } = render(<PrestadorPerfilScreen usuarioId="prest-9" />);
  expect(queryByText("Conversar")).toBeNull();
});
