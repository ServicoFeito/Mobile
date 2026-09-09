import * as SecureStore from "expo-secure-store";

const TAMANHO_MAX_CHUNK = 2000; // expo-secure-store: ~2 KB por entrada
const SUFIXO_CONTAGEM = ".__chunks";

async function limparChunks(key: string): Promise<void> {
  const contagem = await SecureStore.getItemAsync(key + SUFIXO_CONTAGEM);
  if (contagem == null) return;
  const n = Number.parseInt(contagem, 10);
  await SecureStore.deleteItemAsync(key + SUFIXO_CONTAGEM);
  for (let i = 0; i < n; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const contagem = await SecureStore.getItemAsync(key + SUFIXO_CONTAGEM);
    if (contagem != null) {
      const n = Number.parseInt(contagem, 10);
      const partes: string[] = [];
      for (let i = 0; i < n; i++) {
        const parte = await SecureStore.getItemAsync(`${key}.${i}`);
        if (parte == null) return null; // chunk faltando → tratar como ausente
        partes.push(parte);
      }
      return partes.join("");
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await limparChunks(key);
    if (value.length <= TAMANHO_MAX_CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    const n = Math.ceil(value.length / TAMANHO_MAX_CHUNK);
    for (let i = 0; i < n; i++) {
      const slice = value.slice(i * TAMANHO_MAX_CHUNK, (i + 1) * TAMANHO_MAX_CHUNK);
      await SecureStore.setItemAsync(`${key}.${i}`, slice);
    }
    await SecureStore.setItemAsync(key + SUFIXO_CONTAGEM, String(n));
  },

  async removeItem(key: string): Promise<void> {
    await limparChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};
