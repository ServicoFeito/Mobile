import { useAuthStore } from "./authStore";

const supa = require("../api/supabaseClient").supabase;

const fakeSession = (id: string) =>
  ({ user: { id }, access_token: "t", refresh_token: "r" }) as any;

beforeEach(() => {
  useAuthStore.setState({ session: null, usuarioId: null, carregando: true });
  jest.restoreAllMocks();
});

describe("authStore", () => {
  it("hidratar seta session/usuarioId e carregando=false", async () => {
    jest
      .spyOn(supa.auth, "getSession")
      .mockResolvedValue({ data: { session: fakeSession("u1") }, error: null });
    await useAuthStore.getState().hidratar();
    const s = useAuthStore.getState();
    expect(s.usuarioId).toBe("u1");
    expect(s.carregando).toBe(false);
  });

  it("hidratar sem sessão deixa usuarioId null e carregando false", async () => {
    jest.spyOn(supa.auth, "getSession").mockResolvedValue({ data: { session: null }, error: null });
    await useAuthStore.getState().hidratar();
    expect(useAuthStore.getState().usuarioId).toBeNull();
    expect(useAuthStore.getState().carregando).toBe(false);
  });

  it("definirSessao(null) limpa usuarioId", () => {
    useAuthStore.setState({ session: fakeSession("u1"), usuarioId: "u1" });
    useAuthStore.getState().definirSessao(null);
    expect(useAuthStore.getState().usuarioId).toBeNull();
  });

  it("sair chama supabase.auth.signOut e limpa estado", async () => {
    const signOut = jest.spyOn(supa.auth, "signOut").mockResolvedValue({ error: null });
    useAuthStore.setState({ session: fakeSession("u1"), usuarioId: "u1" });
    await useAuthStore.getState().sair();
    expect(signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("iniciarListenerAuth assina onAuthStateChange e devolve unsubscribe", () => {
    const unsub = jest.fn();
    jest
      .spyOn(supa.auth, "onAuthStateChange")
      .mockReturnValue({ data: { subscription: { unsubscribe: unsub } } });
    const stop = useAuthStore.getState().iniciarListenerAuth();
    stop();
    expect(unsub).toHaveBeenCalled();
  });
});
