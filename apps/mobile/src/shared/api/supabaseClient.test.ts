// jest-expo (Node 18) não expõe `WebSocket` global; @supabase/realtime-js >= 2.116
// exige um construtor de WebSocket já na criação do client. Shim só para o ambiente de teste.
(globalThis as { WebSocket?: unknown }).WebSocket ??= class {};

describe("supabaseClient", () => {
  it("exporta um client com auth configurado", () => {
    const { supabase } = require("./supabaseClient");
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });

  it("guardaEnv não lança quando url e anon estão presentes", () => {
    const { guardaEnv } = require("./supabaseClient");
    expect(() => guardaEnv("https://x.supabase.co", "anon")).not.toThrow();
  });

  it("guardaEnv lança quando falta a URL", () => {
    const { guardaEnv } = require("./supabaseClient");
    expect(() => guardaEnv(undefined, "anon")).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it("guardaEnv lança quando falta a ANON key", () => {
    const { guardaEnv } = require("./supabaseClient");
    expect(() => guardaEnv("https://x.supabase.co", undefined)).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
