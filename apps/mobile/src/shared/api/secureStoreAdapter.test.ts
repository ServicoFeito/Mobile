import * as SecureStore from "expo-secure-store";
import { secureStoreAdapter } from "./secureStoreAdapter";

const raw = SecureStore as unknown as { __store: Map<string, string> };

beforeEach(() => raw.__store.clear());

describe("secureStoreAdapter", () => {
  it("round-trip de valor pequeno", async () => {
    await secureStoreAdapter.setItem("sess", "abc");
    expect(await secureStoreAdapter.getItem("sess")).toBe("abc");
  });

  it("getItem de chave inexistente devolve null", async () => {
    expect(await secureStoreAdapter.getItem("nada")).toBeNull();
  });

  it("fatia valor grande e remonta idêntico", async () => {
    const big = "x".repeat(5000);
    await secureStoreAdapter.setItem("sess", big);
    // gravou em chunks, não em "sess" direto
    expect(raw.__store.get("sess")).toBeUndefined();
    expect(raw.__store.get("sess.__chunks")).toBe("3");
    expect(await secureStoreAdapter.getItem("sess")).toBe(big);
  });

  it("regravar menor limpa os chunks antigos", async () => {
    await secureStoreAdapter.setItem("sess", "y".repeat(5000));
    await secureStoreAdapter.setItem("sess", "curto");
    expect(raw.__store.get("sess.__chunks")).toBeUndefined();
    expect(raw.__store.get("sess.2")).toBeUndefined();
    expect(await secureStoreAdapter.getItem("sess")).toBe("curto");
  });

  it("removeItem apaga valor e todos os chunks", async () => {
    await secureStoreAdapter.setItem("sess", "z".repeat(5000));
    await secureStoreAdapter.removeItem("sess");
    expect(await secureStoreAdapter.getItem("sess")).toBeNull();
    expect(raw.__store.get("sess.0")).toBeUndefined();
    expect(raw.__store.get("sess.__chunks")).toBeUndefined();
  });
});
