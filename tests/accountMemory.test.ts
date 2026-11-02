// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addMemory, clearMemory, connectAccountMemory, disconnectAccountMemory, importBrowserMemory, MEMORY_NOTES_MAX,
  readMemory, reloadAccountMemory, removeMemory, useMemory, type MemoryNote, type MemoryRemote,
} from "../src/creature/memory/memoryStore";

/** An account table that records each call; `fail()` makes the next calls reject as if offline. */
function fakeAccount(initial: MemoryNote[] = []) {
  const rows = [...initial];
  const calls: string[] = [];
  let failing = false;
  const settle = <T,>(call: string, work: () => T) => {
    calls.push(call);
    return failing ? Promise.reject(new Error("offline")) : Promise.resolve(work());
  };
  const remote: MemoryRemote = {
    list: () => settle("list", () => [...rows].sort((a, b) => a.createdAt - b.createdAt)),
    insert: notes => settle(`insert ${notes.map(note => note.text).join(" | ")}`, () => { rows.push(...notes); }),
    remove: id => settle("remove", () => { rows.splice(rows.findIndex(row => row.id === id), 1); }),
    clear: () => settle("clear", () => { rows.length = 0; }),
  };
  return { remote, rows, calls, fail: (value = true) => { failing = value; } };
}

const flush = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
const texts = () => readMemory().map(note => note.text);
const accountNote = (text: string, createdAt: number): MemoryNote => ({ id: `row-${createdAt}`, text, createdAt });
const browserStorage = () => (JSON.parse(window.localStorage.getItem("jevling.memory") ?? "null") as { notes: MemoryNote[] } | null)?.notes.map(note => note.text);

beforeEach(() => window.localStorage.clear());
afterEach(() => disconnectAccountMemory());

describe("account memory", () => {
  it("replaces this browser's notes while signed in and gives them back on sign-out", async () => {
    addMemory("Vive en Potosí.", 1);
    const account = fakeAccount([accountNote("Le gusta programar.", 5)]);
    const { result } = renderHook(() => useMemory());
    expect(result.current).toMatchObject({ source: "browser", status: "ready" });

    act(() => connectAccountMemory(account.remote));
    expect(result.current).toMatchObject({ source: "account", status: "loading", notes: [] });
    await flush();
    expect(result.current).toMatchObject({ source: "account", status: "ready", browserNotes: 1 });
    expect(texts()).toEqual(["Le gusta programar."]);

    act(() => disconnectAccountMemory());
    expect(texts()).toEqual(["Vive en Potosí."]);
    expect(result.current.source).toBe("browser");
  });

  it("keeps what Jev learns in the account, never in this browser", async () => {
    const account = fakeAccount();
    connectAccountMemory(account.remote);
    await flush();
    addMemory("Busca una carrera corta.", 10);
    addMemory("busca una CARRERA corta.", 11);
    addMemory("Su celular es 7123-4567.", 12);
    await flush();
    expect(account.rows).toEqual([{ id: expect.stringMatching(/^[0-9a-f-]{36}$/), text: "Busca una carrera corta.", createdAt: 10 }]);
    expect(window.localStorage.getItem("jevling.memory")).toBeNull();
  });

  it("forgets in the account in the order things happened, even before a save finishes", async () => {
    const calls: string[] = [];
    let release = () => {};
    const remote: MemoryRemote = {
      list: () => Promise.resolve([]),
      insert: () => new Promise(resolve => { release = () => { calls.push("insert"); resolve(); }; }),
      remove: () => { calls.push("remove"); return Promise.resolve(); },
      clear: () => Promise.resolve(),
    };
    connectAccountMemory(remote);
    await flush();
    const [kept] = addMemory("Le gusta el fútbol.", 1);
    removeMemory(kept.id);
    expect(texts()).toEqual([]);
    await flush();
    expect(calls).toEqual([]);
    release();
    await flush();
    expect(calls).toEqual(["insert", "remove"]);
  });

  it("«Forget everything» empties the account, including notes kept on other devices", async () => {
    const account = fakeAccount([accountNote("Uno.", 1)]);
    connectAccountMemory(account.remote);
    await flush();
    account.rows.push(accountNote("Desde el celular.", 2));
    clearMemory();
    await flush();
    expect(texts()).toEqual([]);
    expect(account.rows).toEqual([]);
  });

  it("a reload brings what other devices kept, keeps unsaved notes and never brings back forgotten ones", async () => {
    const account = fakeAccount([accountNote("Uno.", 1), accountNote("Dos.", 2)]);
    connectAccountMemory(account.remote);
    await flush();
    account.fail();
    removeMemory("row-1");
    addMemory("Sin conexión.", 3);
    await flush();
    account.fail(false);
    account.rows.push(accountNote("Desde el celular.", 4));
    reloadAccountMemory();
    await flush();
    expect(texts()).toEqual(["Dos.", "Sin conexión.", "Desde el celular."]);
  });

  it("offline from the start, new notes last the session and the panel is told", async () => {
    const account = fakeAccount();
    account.fail();
    const { result } = renderHook(() => useMemory());
    act(() => connectAccountMemory(account.remote));
    await flush();
    expect(result.current.status).toBe("offline");
    expect(() => addMemory("Prefiere estudiar de noche.", 1)).not.toThrow();
    expect(texts()).toEqual(["Prefiere estudiar de noche."]);
  });

  it("a failed reload keeps the notes quietly, but a change that was not saved is announced", async () => {
    const account = fakeAccount([accountNote("Uno.", 1)]);
    const { result } = renderHook(() => useMemory());
    act(() => connectAccountMemory(account.remote));
    await flush();
    account.fail();
    reloadAccountMemory();
    await flush();
    expect(result.current.status).toBe("ready");
    expect(texts()).toEqual(["Uno."]);
    act(() => { addMemory("Dos.", 2); });
    await flush();
    expect(result.current.status).toBe("offline");
  });

  it("keeps the 40 newest notes, like the table does", async () => {
    const account = fakeAccount(Array.from({ length: MEMORY_NOTES_MAX }, (_, index) => accountNote(`Nota ${index}.`, index)));
    connectAccountMemory(account.remote);
    await flush();
    addMemory("La más nueva.", 100);
    expect(readMemory()).toHaveLength(MEMORY_NOTES_MAX);
    expect(texts()[0]).toBe("Nota 1.");
    expect(texts().at(-1)).toBe("La más nueva.");
  });

  it("moves this browser's notes into the account once, keeping their dates and skipping repeats", async () => {
    addMemory("Le gusta programar.", 1);
    addMemory("Vive en Potosí.", 2);
    const account = fakeAccount([accountNote("le gusta PROGRAMAR.", 5)]);
    connectAccountMemory(account.remote);
    await flush();
    await expect(importBrowserMemory()).resolves.toBe(true);
    expect(account.calls).toContain("insert Vive en Potosí.");
    expect(account.rows.find(row => row.text === "Vive en Potosí.")?.createdAt).toBe(2);
    expect(texts()).toEqual(["Vive en Potosí.", "le gusta PROGRAMAR."]);
    expect(browserStorage()).toEqual([]);
    disconnectAccountMemory();
    expect(texts()).toEqual([]);
  });

  it("a failed move keeps the notes in this browser", async () => {
    addMemory("Vive en Potosí.", 2);
    const account = fakeAccount();
    connectAccountMemory(account.remote);
    await flush();
    account.fail();
    await expect(importBrowserMemory()).resolves.toBe(false);
    expect(browserStorage()).toEqual(["Vive en Potosí."]);
  });
});
