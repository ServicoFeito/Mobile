import { render, fireEvent } from "@testing-library/react-native";
import { ErroEstado } from "./ErroEstado";

it("mostra a mensagem e chama onRetry", () => {
  const fn = jest.fn();
  const { getByText } = render(<ErroEstado mensagem="Falhou" onRetry={fn} />);
  getByText("Falhou");
  fireEvent.press(getByText("Tentar de novo"));
  expect(fn).toHaveBeenCalled();
});

it("sem onRetry não renderiza o botão", () => {
  const { queryByText } = render(<ErroEstado mensagem="Falhou" />);
  expect(queryByText("Tentar de novo")).toBeNull();
});
