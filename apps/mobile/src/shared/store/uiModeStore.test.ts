import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUiModeStore } from "./uiModeStore";

beforeEach(async () => {
  await AsyncStorage.clear();
  useUiModeStore.setState({ modo: "contratar", carregado: false });
});

describe("uiModeStore", () => {
  it("carregar sem valor salvo usa 'contratar'", async () => {
    await useUiModeStore.getState().carregar();
    expect(useUiModeStore.getState().modo).toBe("contratar");
    expect(useUiModeStore.getState().carregado).toBe(true);
  });

  it("carregar lê o valor persistido", async () => {
    await AsyncStorage.setItem("@sf/modo", "prestar");
    await useUiModeStore.getState().carregar();
    expect(useUiModeStore.getState().modo).toBe("prestar");
  });

  it("definirModo persiste", async () => {
    await useUiModeStore.getState().definirModo("prestar");
    expect(await AsyncStorage.getItem("@sf/modo")).toBe("prestar");
    expect(useUiModeStore.getState().modo).toBe("prestar");
  });

  it("alternar troca contratar↔prestar e persiste", async () => {
    await useUiModeStore.getState().alternar();
    expect(useUiModeStore.getState().modo).toBe("prestar");
    await useUiModeStore.getState().alternar();
    expect(useUiModeStore.getState().modo).toBe("contratar");
    expect(await AsyncStorage.getItem("@sf/modo")).toBe("contratar");
  });
});
