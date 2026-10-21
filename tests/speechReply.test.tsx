// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechDetail } from "../src/hooks/useSpeechSession";
import { ReplyCard } from "../src/features/reply/SpeechReply";
import ReplySheet from "../src/features/reply/ReplySheet";
import { ReplyBlocks } from "../src/features/reply/ReplyBlocks";
import type { SpeechBlock } from "../src/creature/brain/speechBlocks";
import { preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }) }));
afterEach(cleanup);
beforeEach(() => { preferencesStore.setState({ language: "es", theme: "light", themePreference: "system" }); });

const detail: SpeechDetail = {
  spoken: "Te cuento.",
  blocks: [
    { type: "paragraph", text: "<b>no es HTML</b>" },
    { type: "steps", items: ["Uno", "Dos"] },
    { type: "compare", columns: [{ title: "A", points: ["a1"] }, { title: "B", points: ["b1"] }] },
    { type: "highlight", value: "8", label: "Planetas" },
  ],
  complete: true, generation: 3, language: "es",
};

describe("reply card", () => {
  it("renders the sentence and blocks as text inside a named region", () => {
    render(<ReplyCard detail={detail} onClose={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Respuesta de Jev" });
    expect(region.textContent).toContain("Te cuento.");
    expect(region.textContent).toContain("<b>no es HTML</b>");
    expect(region.querySelector("b")).toBeNull();
    expect(region.querySelectorAll("ol li")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "B" })).toBeTruthy();
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("closes with its button or Escape, but not while typing elsewhere", () => {
    const onClose = vi.fn();
    render(<><input aria-label="otro" /><ReplyCard detail={detail} onClose={onClose} /></>);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "otro" }), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("reply sheet", () => {
  it("answers Jev's question from inside the sheet", () => {
    const onAsk = vi.fn();
    const asking: SpeechDetail = { ...detail, spoken: "¿Qué te atrae más?", blocks: [{ type: "choices", question: "¿Qué te atrae más?", options: ["Programar", "Diseñar"] }] };
    render(<ReplySheet detail={asking} onCollapse={vi.fn()} onAsk={onAsk} />);
    fireEvent.click(within(screen.getByRole("group", { name: "¿Qué te atrae más?" })).getByRole("button", { name: "Programar" }));
    expect(onAsk).toHaveBeenCalledWith("Programar");
  });

  it("is a modal dialog that takes focus and collapses with Escape", async () => {
    const onCollapse = vi.fn();
    render(<ReplySheet detail={detail} onCollapse={onCollapse} />);
    const dialog = screen.getByRole("dialog", { name: "Jev responde" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Jev responde" }));
    expect(dialog.textContent).toContain("Planetas");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(onCollapse).toHaveBeenCalledOnce());
  });

  it("keeps Tab inside the sheet", () => {
    render(<ReplySheet detail={detail} onCollapse={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Cerrar respuesta" });
    const handle = screen.getByRole("button", { name: "Arrastra para ajustar el panel" });
    const region = screen.getByRole("region", { name: "Respuesta de Jev" });
    region.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(handle);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(region);
    expect(close).toBeTruthy();
  });
});

describe("reply blocks", () => {
  it("splits text into staggered words and marks the model's emphasis", () => {
    render(<ReplyBlocks blocks={[{ type: "paragraph", text: "La luz llega a la hoja.", emphasis: ["llega a"] }]} />);
    const words = [...document.querySelectorAll<HTMLElement>(".reply-word")];
    expect(words.map(word => word.textContent)).toEqual(["La", "luz", "llega", "a", "la", "hoja."]);
    expect(words.map(word => word.style.getPropertyValue("--w"))).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(document.querySelector(".reply-emphasis")?.textContent).toBe("llega a");
    expect(document.querySelector(".reply-block")?.textContent).toBe("La luz llega a la hoja.");
  });

  it("labels callouts with text, not only color, in the current language", () => {
    render(<ReplyBlocks blocks={[{ type: "callout", tone: "warning", text: "Cuidado." }, { type: "callout", tone: "tip", text: "Idea." }]} />);
    expect(screen.getByText("Atención:")).toBeTruthy();
    expect(screen.getByText("Consejo:")).toBeTruthy();
  });

  it("sends a follow-up chip and disables chips without a sender", () => {
    const onAsk = vi.fn();
    const chips: SpeechBlock = { type: "chips", items: ["¿Y de noche?"] };
    const { rerender } = render(<ReplyBlocks blocks={[chips]} onAsk={onAsk} />);
    const group = screen.getByRole("navigation", { name: "Preguntas para seguir" });
    fireEvent.click(screen.getByRole("button", { name: "¿Y de noche?" }));
    expect(onAsk).toHaveBeenCalledWith("¿Y de noche?");
    expect(group).toBeTruthy();
    rerender(<ReplyBlocks blocks={[chips]} />);
    expect((screen.getByRole("button", { name: "¿Y de noche?" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows Jev's question as a named group of answers that are sent like messages", () => {
    const onAsk = vi.fn();
    render(<ReplyBlocks blocks={[{ type: "choices", question: "¿Qué te atrae más?", options: ["Programar", "Diseñar"] }]} onAsk={onAsk} />);
    const group = screen.getByRole("group", { name: "¿Qué te atrae más?" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Diseñar" }));
    expect(onAsk).toHaveBeenCalledWith("Diseñar");
    expect(screen.getByText("O escríbeme tu respuesta.")).toBeTruthy();
  });

  it("orders the cascade after the spoken lead", () => {
    render(<ReplyBlocks blocks={[{ type: "highlight", value: "8", label: "Planetas" }, { type: "list", items: ["Uno", "Dos"] }]} />);
    const blocks = [...document.querySelectorAll<HTMLElement>(".reply-block")];
    expect(blocks.map(block => block.style.getPropertyValue("--i"))).toEqual(["1", "2"]);
    expect(blocks[0].querySelector(".reply-highlight__value")?.textContent).toBe("8");
  });
});
