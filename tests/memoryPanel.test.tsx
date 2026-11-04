// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryPanel from "../src/features/memory/MemoryPanel";
import { addMemory, connectAccountMemory, disconnectAccountMemory, readMemory, type MemoryNote, type MemoryRemote } from "../src/creature/memory/memoryStore";
import { accountStore } from "../src/features/account/accountStore";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }) }));
afterEach(() => {
  cleanup();
  disconnectAccountMemory();
  accountStore.setState({ status: "unavailable", email: null, failed: false });
});
beforeEach(() => {
  window.localStorage.clear();
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system" });
});

const texts = () => readMemory().map(note => note.text);

describe("memory panel", () => {
  it("is a modal dialog listing notes newest first, with when they were kept", () => {
    addMemory("Le gusta programar.", Date.now() - 2 * 86_400_000);
    addMemory("Busca una carrera corta.", Date.now());
    render(<MemoryPanel onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Lo que Jev recuerda" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Lo que Jev recuerda" }));
    expect(screen.getByText("Se guarda solo en este navegador.")).toBeTruthy();
    const items = [...dialog.querySelectorAll("li")].map(item => item.textContent);
    expect(items[0]).toContain("Busca una carrera corta.");
    expect(items[1]).toContain("Le gusta programar.");
    expect(items[1]).toContain("anteayer");
  });

  it("forgets one note and keeps focus in the list", async () => {
    addMemory("Le gusta programar.", 1);
    addMemory("Busca una carrera corta.", 2);
    render(<MemoryPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Olvidar: Busca una carrera corta." }));
    expect(texts()).toEqual(["Le gusta programar."]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Olvidar: Le gusta programar." })));
  });

  it("asks before forgetting everything, and Escape first cancels the question", () => {
    addMemory("Le gusta programar.", 1);
    const onClose = vi.fn();
    render(<MemoryPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Olvidar todo" }));
    expect(screen.getByText("¿Olvido todo lo que recuerdo de ti?")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(texts()).toEqual(["Le gusta programar."]);

    fireEvent.click(screen.getByRole("button", { name: "Olvidar todo" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Olvidar todo" }).at(-1)!);
    expect(texts()).toEqual([]);
    expect(screen.getByText("Todavía no recuerdo nada de ti.")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes with its button or the backdrop and keeps Home's shortcuts from firing behind it", () => {
    const onClose = vi.fn();
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    render(<MemoryPanel onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "d" });
    expect(onWindowKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar memoria" }));
    fireEvent.click(document.querySelector(".memory__backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(2);
    window.removeEventListener("keydown", onWindowKey);
  });

  it("speaks English when the interface does", () => {
    act(() => preferencesStore.setState({ language: "en" }));
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "What Jev remembers" })).toBeTruthy();
    expect(screen.getByText("I don't remember anything about you yet.")).toBeTruthy();
  });
});

/** The visitor's account: lists `rows`, or fails every call when offline. */
function account(rows: MemoryNote[], offline = false): MemoryRemote {
  const settle = <T,>(work: () => T) => offline ? Promise.reject(new Error("offline")) : Promise.resolve(work());
  return {
    list: () => settle(() => [...rows]),
    insert: notes => settle(() => { rows.push(...notes); }),
    remove: id => settle(() => { rows.splice(rows.findIndex(row => row.id === id), 1); }),
    clear: () => settle(() => { rows.length = 0; }),
  };
}

describe("memory panel with an account", () => {
  it("offers Google sign-in while notes live in this browser, and says when it fails", async () => {
    act(() => accountStore.setState({ status: "signedOut" }));
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Se guarda solo en este navegador.");
    // The test build has no Supabase, so the sign-in fails like an unreachable project.
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión con Google" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No se pudo iniciar sesión. Inténtalo de nuevo.");
  });

  it("says the notes are in the account and moves this browser's notes there when asked", async () => {
    addMemory("Le gusta programar.", 1);
    addMemory("Vive en Potosí.", 2);
    const rows: MemoryNote[] = [{ id: "row-1", text: "Busca una carrera corta.", createdAt: 3 }];
    act(() => connectAccountMemory(account(rows)));
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(await screen.findByText("Guardado en tu cuenta.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Iniciar sesión con Google" })).toBeNull();
    expect(screen.getByText(/Este navegador tiene notas de antes/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Llevar 2 notas a tu cuenta" }));
    expect(screen.getByRole("button", { name: "Llevando…" })).toHaveProperty("disabled", true);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Llevar/ })).toBeNull());
    expect(rows.map(row => row.text)).toEqual(["Busca una carrera corta.", "Le gusta programar.", "Vive en Potosí."]);
    expect(texts()).toEqual(["Le gusta programar.", "Vive en Potosí.", "Busca una carrera corta."]);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Lo que Jev recuerda" }));
    disconnectAccountMemory();
    expect(texts()).toEqual([]);
  });

  it("warns when the account cannot be reached, and Jev keeps going", async () => {
    act(() => connectAccountMemory(account([], true)));
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(await screen.findByText("Sin conexión con tu cuenta: lo nuevo dura solo esta sesión.")).toBeTruthy();
  });

  // Last: «Not now» holds for the rest of the visit, and this module is shared by the whole file.
  it("«Not now» keeps the notes in this browser and stops offering for this visit", async () => {
    addMemory("Vive en Potosí.", 2);
    act(() => connectAccountMemory(account([])));
    render(<MemoryPanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
    expect(screen.queryByText(/Este navegador tiene notas de antes/)).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Lo que Jev recuerda" }));
    cleanup();
    render(<MemoryPanel onClose={vi.fn()} />);
    expect(await screen.findByText("Guardado en tu cuenta.")).toBeTruthy();
    expect(screen.queryByText(/Este navegador tiene notas de antes/)).toBeNull();
    disconnectAccountMemory();
    expect(texts()).toEqual(["Vive en Potosí."]);
  });
});
