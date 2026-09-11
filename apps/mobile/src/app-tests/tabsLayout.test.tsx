import { render } from "@testing-library/react-native";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import TabsLayout from "../../app/(app)/(tabs)/_layout";

jest.mock("expo-router", () => ({
  Tabs: Object.assign(
    ({ children }: any) => <>{children}</>,
    { Screen: ({ name, options }: any) => <mock-screen data-name={name} data-href={String(options?.href)} /> },
  ),
}));

it("modo contratar oculta vagas", () => {
  useUiModeStore.setState({ modo: "contratar", carregado: true });
  const { UNSAFE_getAllByType } = render(<TabsLayout />);
  const screens = UNSAFE_getAllByType("mock-screen" as any);
  const byName = Object.fromEntries(screens.map((s: any) => [s.props["data-name"], s.props["data-href"]]));
  expect(byName.vagas).toBe("null");
  expect(byName.buscar).not.toBe("null");
  expect(byName.trabalhos).not.toBe("null");
});

it("modo prestar oculta buscar", () => {
  useUiModeStore.setState({ modo: "prestar", carregado: true });
  const { UNSAFE_getAllByType } = render(<TabsLayout />);
  const screens = UNSAFE_getAllByType("mock-screen" as any);
  const byName = Object.fromEntries(screens.map((s: any) => [s.props["data-name"], s.props["data-href"]]));
  expect(byName.buscar).toBe("null");
  expect(byName.vagas).not.toBe("null");
  expect(byName.trabalhos).not.toBe("null");
});
