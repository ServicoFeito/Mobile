import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Modo = "contratar" | "prestar";
const CHAVE = "@sf/modo";

interface UiModeState {
  modo: Modo;
  carregado: boolean;
  carregar: () => Promise<void>;
  definirModo: (modo: Modo) => Promise<void>;
  alternar: () => Promise<void>;
}

export const useUiModeStore = create<UiModeState>((set, get) => ({
  modo: "contratar",
  carregado: false,

  carregar: async () => {
    const salvo = await AsyncStorage.getItem(CHAVE);
    set({ modo: salvo === "prestar" ? "prestar" : "contratar", carregado: true });
  },

  definirModo: async (modo) => {
    await AsyncStorage.setItem(CHAVE, modo);
    set({ modo });
  },

  alternar: async () => {
    const proximo: Modo = get().modo === "contratar" ? "prestar" : "contratar";
    await get().definirModo(proximo);
  },
}));
