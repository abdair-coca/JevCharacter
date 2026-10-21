// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryPanel from "../src/features/memory/MemoryPanel";
import { addMemory, readMemory } from "../src/creature/memory/memoryStore";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }) }));
afterEach(cleanup);
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
