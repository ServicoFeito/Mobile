import { render, fireEvent } from "@testing-library/react-native";
import { Botao } from "./Botao";

it("dispara onPress quando habilitado", () => {
  const fn = jest.fn();
  const { getByText } = render(<Botao titulo="OK" onPress={fn} />);
  fireEvent.press(getByText("OK"));
  expect(fn).toHaveBeenCalled();
});

it("não dispara quando desabilitado ou carregando", () => {
  const fn = jest.fn();
  const { getByText, rerender, queryByText } = render(<Botao titulo="OK" onPress={fn} desabilitado />);
  fireEvent.press(getByText("OK"));
  expect(fn).not.toHaveBeenCalled();
  rerender(<Botao titulo="OK" onPress={fn} carregando />);
  expect(queryByText("OK")).toBeNull(); // mostra spinner, não o título
});
