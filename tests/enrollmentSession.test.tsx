// @vitest-environment jsdom
import { StrictMode } from "react";
import { LazyMotion, domMax } from "motion/react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../src/pages/HomePage";
import { preferencesStore } from "../src/stores/preferencesStore";
import type { CharacterController } from "../src/character/useCharacterController";
import { decision, jsonResponse } from "./helpers";

type CharacterProps = { onReady?: () => void; onError?: () => void; active?: boolean };
const mocks = vi.hoisted(() => ({ props: {} as CharacterProps, idle: vi.fn(), playFor: vi.fn(), stop: vi.fn() }));
vi.mock("../src/lib/motionTokens", () => ({
  useUiMotion: () => ({ duration: 0 }), useFeedbackScale: () => 1,
  useOrganicMotion: () => ({ reduced: true, spring: { duration: 0 } }), cssDurationSeconds: () => 0,
}));
vi.mock("../src/components/Character", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const noop = async () => {};
  const controller = { idle: mocks.idle, stop: mocks.stop, playFor: mocks.playFor, play: noop, think: noop, morph: noop, sequence: noop, bump: noop, hello: noop, ghost: noop, flower: noop, talk: noop, answer: noop, cloud: noop } satisfies CharacterController;
  return { default: forwardRef<CharacterController, CharacterProps>(function MockCharacter(props, ref) {
    useImperativeHandle(ref, () => controller, []); mocks.props = props;
    return <div data-testid="character" data-active={props.active} />;
  }) };
});
const view = (active = true) => <StrictMode><LazyMotion features={domMax}><HomePage active={active} /></LazyMotion></StrictMode>;
const open = (text = "quiero inscribirme") => {
  const input = screen.getByLabelText("Dale contexto a Jev");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
};
const fill = () => {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "María Ejemplo" } });
  fireEvent.change(screen.getByLabelText("Número de celular"), { target: { value: "+591 7123-4567" } });
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(decision())));
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "light" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Home enrollment boundary", () => {
  it("opens both fields, validates, confirms and returns using the same character without transmitting or storing fields", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(view()); const character = await screen.findByTestId("character");
    act(() => mocks.props.onReady?.()); open();
    expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
    expect(screen.getByLabelText("Número de celular")).toBeTruthy();
    expect(document.querySelectorAll("#page-title")).toHaveLength(1);
    expect(document.getElementById("page-title")?.closest(".enrollment")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Dale contexto a Jev" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar datos/ }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    fill(); fireEvent.click(screen.getByRole("button", { name: /Confirmar datos/ }));
    expect(screen.getByText("Datos completados")).toBeTruthy();
    expect(document.querySelector(".home-page")?.getAttribute("data-enrollment")).toBe("confirmed");
    expect(document.querySelector<HTMLInputElement>("#enrollment-name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Volver a Jev/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Dale contexto a Jev" })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByLabelText("Dale contexto a Jev"));
    expect(document.getElementById("page-title")?.closest(".intro-copy")).toBeTruthy();
    expect(screen.getByTestId("character")).toBe(character);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(storage.mock.calls)).not.toMatch(/María|7123/);
  });

  it("discards values on close and route leave but preserves an open form through preferences and tab suspension", async () => {
    const result = render(view()); await screen.findByTestId("character"); open(); fill();
    act(() => { preferencesStore.getState().setLanguage("en"); preferencesStore.getState().setThemePreference("dark"); });
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("María Ejemplo");
    act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    expect(mocks.props.active).toBe(false);
    act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    expect((screen.getByLabelText("Mobile number") as HTMLInputElement).value).toBe("+591 7123-4567");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.querySelector(".home-page")?.getAttribute("data-enrollment")).toBe("closed"));
    act(() => preferencesStore.getState().setLanguage("es")); open();
    expect((screen.getByLabelText("Nombre completo") as HTMLInputElement).value).toBe("");
    fill(); result.rerender(view(false)); result.rerender(view()); open();
    expect((screen.getByLabelText("Nombre completo") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Número de celular") as HTMLInputElement).value).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the form usable with a failed character, and late readiness never reopens a closed experience", async () => {
    render(view()); await screen.findByTestId("character"); open();
    act(() => mocks.props.onError?.());
    expect(screen.getByText("Puedes continuar con tus datos.")).toBeTruthy();
    fill(); fireEvent.click(screen.getByRole("button", { name: /Confirmar datos/ }));
    expect(screen.getByText("Datos completados")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar inscripción" }));
    await waitFor(() => expect(document.querySelector(".home-page")?.getAttribute("data-enrollment")).toBe("closed"));
    act(() => mocks.props.onReady?.());
    expect(screen.queryByText("Datos completados")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels a pending conversation decision before enrollment and rejects its late result", async () => {
    let resolve: (response: Response) => void = () => {};
    const pending = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", pending);
    render(view()); await screen.findByTestId("character");
    open("Hola Jev");
    await waitFor(() => expect(pending).toHaveBeenCalledOnce());
    const signal = pending.mock.calls[0][1]?.signal;
    open(); expect(signal?.aborted).toBe(true);
    await act(async () => resolve(jsonResponse(decision({ kind: "reaction", reaction: "GHOST" }))));
    expect(screen.getByLabelText("Nombre completo")).toBeTruthy();
    expect(mocks.playFor).not.toHaveBeenCalledWith("Ghost", expect.anything());
    expect(pending).toHaveBeenCalledOnce();
  });
});
