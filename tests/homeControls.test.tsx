// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContextWhisper from "../src/components/ContextWhisper";
import BrainHUD from "../src/components/BrainHUD";
import { preferencesStore } from "../src/stores/preferencesStore";
import { decision } from "./helpers";

vi.mock("../src/lib/motionTokens", () => ({
  useUiMotion: () => ({ duration: 0 }), useFeedbackScale: () => 1.04,
  useOrganicMotion: () => ({ reduced: true, breathe: 4.8, consider: 1.6, stagger: 0, scale: 1, revealScale: 1, pressScale: 1, turn: 0, opacityLow: 0.22, opacityHigh: 0.52, spring: { duration: 0 } }),
}));
afterEach(cleanup);
beforeEach(() => { preferencesStore.setState({ language: "es", theme: "light", themePreference: "system" }); });

describe("Home input", () => {
  it("rejects blank input, trims submitted context, clears the draft and exposes the limit", () => {
    const submit = vi.fn();
    render(<ContextWhisper context="" onSubmit={submit} onClear={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Dale contexto a Jev" });
    expect(input.getAttribute("maxlength")).toBe("280");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  Hola Jev  " } });
    fireEvent.submit(input.closest("form")!);
    expect(submit).toHaveBeenCalledWith("Hola Jev");
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Contexto enviado");
  });
  it("preserves the draft when changing language or theme and localizes accessible controls", () => {
    render(<ContextWhisper context="Hola" onSubmit={vi.fn()} onClear={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mi mensaje" } });
    act(() => { preferencesStore.getState().setLanguage("en"); preferencesStore.getState().setThemePreference("dark"); });
    expect((screen.getByRole("textbox", { name: "Give Jev context" }) as HTMLInputElement).value).toBe("Mi mensaje");
    expect(screen.getByRole("button", { name: "Clear conversation" })).toBeTruthy();
  });
  it("shows the real deciding state without preventing replacement context", () => {
    const submit = vi.fn();
    render(<ContextWhisper context="Anterior" status="deciding" attention={0.7} onSubmit={submit} onClear={vi.fn()} />);
    expect(screen.getByText("Decidiendo")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nuevo contexto" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar a Jev" }));
    expect(submit).toHaveBeenCalledWith("Nuevo contexto");
  });
});

describe("Home HUD", () => {
  it("localizes speech failures as a status outside Jev's reply", () => {
    render(<BrainHUD decision={decision()} status="observing" personality={{ energy: 50, trust: 40, curiosity: 60 }} speechNotice="unavailable" />);
    expect(screen.getByRole("status").textContent).toBe("El habla no está disponible. Inténtalo de nuevo.");
    act(() => preferencesStore.getState().setLanguage("en"));
    expect(screen.getByRole("status").textContent).toBe("Speech is unavailable. Please try again.");
    expect(document.querySelector(".speech-caption")).toBeNull();
  });
  it("shows the selected action, actual confidence and fallback source, with details absent when collapsed", () => {
    render(<BrainHUD decision={decision({ kind: "morph", form: "triangle" })} status="observing" personality={{ energy: 50, trust: 40, curiosity: 60 }} />);
    const summary = screen.getByRole("button");
    expect(summary.textContent).toContain("Triángulo");
    expect(summary.textContent).toContain("Confianza");
    expect(document.getElementById("brain-details")).toBeNull();
    fireEvent.click(summary);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Probabilidades de reacción")).toBeTruthy();
    act(() => preferencesStore.getState().setLanguage("en"));
    expect(screen.getByText("Reaction probabilities")).toBeTruthy();
    expect(summary.getAttribute("aria-expanded")).toBe("true");
  });
  it("displays real probabilities and keeps a closing panel out of the accessibility tree", () => {
    render(<BrainHUD decision={{ ...decision(), source: "fallback", actionConfidence: 0.42 }} status="observing" personality={{ energy: 50, trust: 40, curiosity: 60 }} />);
    expect(screen.getByText("Instinto local")).toBeTruthy();
    expect(screen.getByRole("button").textContent).toContain("42");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("80%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    const panel = document.getElementById("brain-details");
    expect(panel === null || (panel.hasAttribute("inert") && panel.getAttribute("aria-hidden") === "true")).toBe(true);
  });
  it("closes the details with Escape while retaining the summary and its focus", () => {
    render(<BrainHUD decision={decision()} status="observing" personality={{ energy: 50, trust: 40, curiosity: 60 }} />);
    const summary = screen.getByRole("button");
    summary.focus();
    fireEvent.click(summary);
    expect(summary.getAttribute("aria-controls")).toBe("brain-details");
    fireEvent.keyDown(summary, { key: "Escape" });
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(summary.hasAttribute("aria-controls")).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
});
