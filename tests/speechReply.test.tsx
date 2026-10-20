// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechDetail } from "../src/hooks/useSpeechSession";
import { ReplyCard, ReplyPreview, ReplySheet } from "../src/features/reply/SpeechReply";
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

describe("reply preview and sheet", () => {
  it("opens the full reply or discards it from the preview", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<ReplyPreview detail={detail} onOpen={onOpen} onClose={onClose} openRef={createRef()} />);
    fireEvent.click(screen.getByRole("button", { name: "Leer todo" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
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
    const close = screen.getByRole("button", { name: "Volver a la vista previa" });
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
