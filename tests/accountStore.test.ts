// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthCallback = (event: string, session: unknown) => void;

const fake = vi.hoisted(() => {
  const state = { saved: false, callback: null as null | ((event: string, session: unknown) => void), rows: [] as unknown[], calls: [] as unknown[][] };
  const auth = {
    onAuthStateChange: vi.fn((callback: AuthCallback) => { state.callback = callback; }),
    initialize: vi.fn(() => Promise.resolve({ error: null as Error | null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null as unknown } })),
    signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  };
  // The memories table as PostgREST answers it through the visitor's session.
  const from = vi.fn((table: string) => ({
    select: (columns: string) => ({
      order: (column: string, options: unknown) => ({
        limit: (count: number) => {
          state.calls.push(["select", table, columns, column, options, count]);
          return Promise.resolve({ data: state.rows, error: null });
        },
      }),
    }),
    insert: (values: unknown) => { state.calls.push(["insert", table, values]); return Promise.resolve({ error: null }); },
    delete: () => ({ eq: (column: string, value: string) => { state.calls.push(["delete", table, column, value]); return Promise.resolve({ error: null }); } }),
  }));
  const loadSupabase = vi.fn(() => Promise.resolve({ auth, from }));
  return { state, auth, from, loadSupabase, forgetAuthLeftovers: vi.fn() };
});

vi.mock("../src/lib/supabaseClient", () => ({
  supabaseConfigured: () => true,
  hasSavedAuth: () => fake.state.saved,
  loadSupabase: fake.loadSupabase,
  forgetAuthLeftovers: fake.forgetAuthLeftovers,
}));

const session = { user: { id: "user-1", email: "ana@example.com" } };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function load() {
  const account = await import("../src/features/account/accountStore");
  const memory = await import("../src/creature/memory/memoryStore");
  return { ...account, ...memory };
}

/** Supabase reports a session change; the store reacts a tick later. */
async function emit(event: string, value: unknown) {
  fake.state.callback?.(event, value);
  await flush();
  await flush();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fake.state.saved = false;
  fake.state.callback = null;
  fake.state.rows = [];
  fake.state.calls = [];
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("account", () => {
  it("never loads Supabase at startup without a saved session", async () => {
    const { startAccount, accountStore } = await load();
    startAccount();
    await flush();
    expect(fake.loadSupabase).not.toHaveBeenCalled();
    expect(accountStore.getState().status).toBe("signedOut");
  });

  it("signs in from a saved session and the account's notes replace this browser's", async () => {
    fake.state.saved = true;
    fake.state.rows = [
      { id: "b", text: "Vive en Potosí.", created_at: "2026-11-01T10:00:00Z" },
      { id: "a", text: "Le gusta programar.", created_at: "2026-10-30T10:00:00Z" },
      { id: 3, text: "Fila inválida." },
    ];
    fake.auth.getSession.mockResolvedValueOnce({ data: { session } });
    const { startAccount, accountStore, addMemory, readMemory } = await load();
    addMemory("Nota del navegador.", 1);
    startAccount();
    expect(accountStore.getState().status).toBe("connecting");
    await flush();
    await emit("INITIAL_SESSION", session);

    expect(accountStore.getState()).toMatchObject({ status: "signedIn", email: "ana@example.com", failed: false });
    expect(fake.state.calls[0]).toEqual(["select", "memories", "id, text, created_at", "created_at", { ascending: false }, 40]);
    expect(readMemory().map(note => note.text)).toEqual(["Le gusta programar.", "Vive en Potosí."]);
    expect(fake.forgetAuthLeftovers).not.toHaveBeenCalled();
  });

  it("writes the visitor's notes to the memories table", async () => {
    fake.state.saved = true;
    const { startAccount, addMemory, removeMemory, clearMemory } = await load();
    startAccount();
    await flush();
    await emit("INITIAL_SESSION", session);
    const [kept] = addMemory("Busca una carrera corta.", Date.parse("2026-11-01T12:00:00Z"));
    removeMemory(kept.id);
    clearMemory();
    await flush();
    await flush();
    expect(fake.state.calls.slice(1)).toEqual([
      ["insert", "memories", [{ id: kept.id, text: "Busca una carrera corta.", created_at: "2026-11-01T12:00:00.000Z" }]],
      ["delete", "memories", "id", kept.id],
      ["delete", "memories", "user_id", "user-1"],
    ]);
  });

  it("leaves for Google and asks to come back to the same view", async () => {
    window.history.replaceState(null, "", "/about?x=1");
    const { signIn, accountStore } = await load();
    await signIn();
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: `${window.location.origin}/about` } });
    await emit("INITIAL_SESSION", null);
    expect(accountStore.getState().status).toBe("connecting");
  });

  it("a cancelled Google sign-in says so, cleans the address and forgets what it left behind", async () => {
    fake.state.saved = true;
    window.history.replaceState(null, "", "/?error=access_denied&error_description=cancelled&x=1#error=access_denied");
    fake.auth.initialize.mockResolvedValueOnce({ error: new Error("cancelled") });
    const { startAccount, accountStore } = await load();
    startAccount();
    await flush();
    await emit("INITIAL_SESSION", null);
    expect(accountStore.getState()).toMatchObject({ status: "signedOut", failed: true });
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/?x=1");
    expect(fake.forgetAuthLeftovers).toHaveBeenCalledOnce();
  });

  it("when Supabase cannot load, sign-in fails with a notice instead of hanging", async () => {
    fake.loadSupabase.mockRejectedValueOnce(new Error("offline"));
    const { signIn, accountStore } = await load();
    await signIn();
    expect(accountStore.getState()).toMatchObject({ status: "signedOut", failed: true });
  });

  it("signing out of this browser only gives back this browser's notes", async () => {
    fake.state.saved = true;
    fake.state.rows = [{ id: "a", text: "Le gusta programar.", created_at: "2026-10-30T10:00:00Z" }];
    const { startAccount, signOut, accountStore, addMemory, readMemory } = await load();
    addMemory("Nota del navegador.", 1);
    startAccount();
    await flush();
    await emit("INITIAL_SESSION", session);
    expect(readMemory().map(note => note.text)).toEqual(["Le gusta programar."]);

    await signOut();
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await emit("SIGNED_OUT", null);
    expect(accountStore.getState()).toMatchObject({ status: "signedOut", email: null });
    expect(readMemory().map(note => note.text)).toEqual(["Nota del navegador."]);
  });
});
