// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "../src/features/settings/SettingsPanel";
import { clearGroqKey, readGroqKey } from "../src/creature/brain/groqKeyStore";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }) }));

const KEY = "gsk_test_visible_key_1234567890";
const NO_KEY = "Sin clave, Jev no puede generar respuestas habladas.";

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  clearGroqKey();
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system", sound: true });
});

describe("settings panel", () => {
  it("is a modal dialog named Ajustes, focuses its title and closes with Escape", () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Ajustes" }).getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Ajustes");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("turns Jev's sound off and on without changing the other preferences", () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const sound = screen.getByRole("button", { name: "Sonido de Jev" });
    expect(sound.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(sound);
    expect(sound.getAttribute("aria-pressed")).toBe("false");
    expect(preferencesStore.getState()).toMatchObject({ sound: false, theme: "light", language: "es" });
    fireEvent.click(sound);
    expect(preferencesStore.getState().sound).toBe(true);
  });

  it("changes the interface language and the dialog follows it", () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Español" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(preferencesStore.getState()).toMatchObject({ language: "en", theme: "light" });
  });

  it("saves a well-formed Groq key in this browser, empties the field and keeps focus inside", async () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe(NO_KEY);
    const input = screen.getByLabelText("Clave API") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.change(input, { target: { value: `  ${KEY}  ` } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(readGroqKey()).toBe(KEY);
    expect(window.localStorage.getItem("jevling.groqKey")).toBe(JSON.stringify(KEY));
    expect(input.value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Clave guardada en este navegador.");
    expect(screen.getByRole("button", { name: "Borrar clave" })).toBeTruthy();
    // The save button is disabled now; focus must not fall back to the page, or Escape stops working.
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("rejects a malformed key, saves nothing and points the error at the field", () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const input = screen.getByLabelText("Clave API");
    fireEvent.change(input, { target: { value: "corta" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(readGroqKey()).toBeNull();
    expect(window.localStorage.getItem("jevling.groqKey")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByText("Revisa la clave: debe tener entre 20 y 200 caracteres, sin espacios.").id);
  });

  it("removes the saved key and reports that Jev has none again", () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Clave API"), { target: { value: KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar clave" }));
    expect(readGroqKey()).toBeNull();
    expect(window.localStorage.getItem("jevling.groqKey")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(NO_KEY);
  });
});
