// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterController } from "../src/character/useCharacterController";
import App from "../src/App";
import { clearGroqKey, saveGroqKey } from "../src/creature/brain/groqKeyStore";
import { homeVoice } from "../src/creature/voice/geminiVoice";
import { preferencesStore } from "../src/stores/preferencesStore";
import { decision, jsonResponse } from "./helpers";

vi.mock("../src/lib/motionTokens", () => ({
  useUiMotion: () => ({ duration: 0 }), useFeedbackScale: () => 1,
  useThemeIconMotion: () => ({ turn: 0, scale: 1 }),
  useOrganicMotion: () => ({ reduced: true, breathe: 4.8, consider: 1.6, stagger: 0, scale: 1, revealScale: 1, pressScale: 1, turn: 0, opacityLow: 0.22, opacityHigh: 0.52, spring: { duration: 0 } }),
}));
// Isolate the persistent shell contract; Features playback has its own tests.
vi.mock("../src/pages/FeaturesPage", () => ({ default: () => <main><h1 data-page-route="/features">Capacidades</h1></main> }));
vi.mock("../src/components/Character", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  const controller = {
    stop: vi.fn(), think: vi.fn(), idle: vi.fn(), talk: vi.fn(), speak: vi.fn(), playFor: vi.fn(),
    play: vi.fn(), morph: vi.fn(), bump: vi.fn(), answer: vi.fn(), sequence: vi.fn(),
    hello: vi.fn(), ghost: vi.fn(), flower: vi.fn(), cloud: vi.fn(),
  } as unknown as CharacterController;
  return { default: forwardRef<CharacterController, { active?: boolean }>(function MockCharacter({ active }, ref) {
    useImperativeHandle(ref, () => controller, []);
    return <div data-testid="character" data-active={active} />;
  }) };
});

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system" });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(cleanup);

describe("persistent Home shell", () => {
  it("retains draft, context, expanded HUD and character across provisional routes", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(decision())));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const character = await screen.findByTestId("character");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Contexto guardado" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Borrar conversación" })).toBeTruthy());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Borrador pendiente" } });
    fireEvent.click(within(screen.getByRole("complementary", { name: "Detalles de la decisión" })).getByRole("button"));
    fireEvent.click(screen.getByRole("link", { name: "Capacidades" }));
    await screen.findByRole("heading", { name: "Capacidades" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(character.isConnected).toBe(true);
    expect(character.getAttribute("data-active")).toBe("false");
    expect(document.querySelector(".home-session")?.hasAttribute("inert")).toBe(true);
    act(() => preferencesStore.getState().setLanguage("en"));
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    const input = await screen.findByRole("textbox", { name: "Give Jev context" });
    expect((input as HTMLInputElement).value).toBe("Borrador pendiente");
    expect(screen.getByRole("button", { name: "Clear conversation" })).toBeTruthy();
    expect(screen.getByText("Reaction probabilities")).toBeTruthy();
    expect(screen.getByTestId("character")).toBe(character);
    expect(character.getAttribute("data-active")).toBe("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe("stopping Jev", () => {
    // A reply that has started and never ends: Jev stays talking until something stops him.
    function talkingFetch() {
      const encoder = new TextEncoder();
      return vi.fn((url: RequestInfo | URL) => {
        if (String(url) === "/api/decide") return Promise.resolve(jsonResponse(decision({ kind: "talk", state: "Talk" })));
        const body = new ReadableStream<Uint8Array>({ start: controller => controller.enqueue(encoder.encode('event: spoken\ndata: {"text":"Te cuento algo muy largo."}\n\n')) });
        return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
      });
    }
    async function startTalking() {
      saveGroqKey("gsk_test_visible_key_1234567890");
      vi.stubGlobal("fetch", talkingFetch());
      const stopSpeech = vi.spyOn(homeVoice, "stopSpeech");
      render(<App />);
      const character = await screen.findByTestId("character");
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Cuéntame algo" } });
      fireEvent.submit(screen.getByRole("textbox").closest("form")!);
      await waitFor(() => expect(document.querySelector(".speech-caption")?.textContent).toBe("Te cuento algo muy largo."));
      return { character, stopSpeech };
    }
    afterEach(() => {
      clearGroqKey();
      vi.restoreAllMocks();
    });

    it("Escape from the field cuts his voice and leaves the text and the field alone", async () => {
      const { stopSpeech } = await startTalking();
      const input = screen.getByRole<HTMLInputElement>("textbox");
      input.focus();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(stopSpeech).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(input);
      expect(document.querySelector(".speech-caption")?.textContent).toBe("Te cuento algo muy largo.");
      // Jev no longer talks: the next press does what it did before.
      fireEvent.keyDown(input, { key: "Escape" });
      expect(stopSpeech).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(input);
    });

    it("tapping his body cuts his voice; tapping the stage or his canvas far from him does not", async () => {
      const { character, stopSpeech } = await startTalking();
      vi.spyOn(document.querySelector(".creature-presence")!, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 400, 400));
      fireEvent.pointerDown(document.querySelector(".home-page")!, { clientX: 300, clientY: 300 });
      fireEvent.pointerDown(character, { clientX: 490, clientY: 300 });
      expect(stopSpeech).not.toHaveBeenCalled();
      fireEvent.pointerDown(character, { clientX: 340, clientY: 340 });
      expect(stopSpeech).toHaveBeenCalledTimes(1);
    });
  });

  it("does not initialize Home on a direct Features visit", async () => {
    window.history.replaceState(null, "", "/features");
    render(<App />);
    await screen.findByRole("heading", { name: "Capacidades" });
    expect(document.querySelector(".home-session")).toBeNull();
    expect(screen.queryByTestId("character")).toBeNull();
  });
});
