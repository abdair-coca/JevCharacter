// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptsBlock, githubUrl, historyReply, parseBlock, type SpeechBlock } from "../src/creature/brain/speechBlocks";
import { streamSpeechReply } from "../src/creature/brain/speechClient";
import { ReplyBlocks } from "../src/features/reply/ReplyBlocks";
import SettingsPanel from "../src/features/settings/SettingsPanel";
import { DEFAULT_PLUGINS, preferencesStore } from "../src/stores/preferencesStore";

vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), useOrganicMotion: () => ({ spring: { duration: 0 } }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  window.localStorage.clear();
  preferencesStore.setState({ language: "es", theme: "light", themePreference: "system", plugins: DEFAULT_PLUGINS });
});

describe("plugin blocks", () => {
  it.each([
    "https://github.com/facebook/react",
    "https://github.com/facebook/react/issues/1",
  ])("links the GitHub page %s", (url) => {
    expect(githubUrl(url)).toBe(url);
  });

  it.each([
    "http://github.com/facebook/react",
    "https://github.com.evil.example/x",
    "https://evil.example/github.com/x",
    "https://user:pass@github.com/x",
    "https://github.com:8443/x",
    "https://github.com/",
    "javascript:alert(1)",
    42,
  ])("never links %s", (url) => {
    expect(githubUrl(url)).toBeNull();
  });

  it("keeps up to three valid GitHub links and drops the rest", () => {
    const block = parseBlock({ type: "links", items: [
      { label: "React", url: "https://github.com/facebook/react" },
      { label: "Phish", url: "https://evil.example/x" },
      { label: "", url: "https://github.com/a/b" },
      { label: "Vue", url: "https://github.com/vuejs/core" },
      { label: "Svelte", url: "https://github.com/sveltejs/svelte" },
      { label: "Solid", url: "https://github.com/solidjs/solid" },
    ] });
    expect(block).toEqual({ type: "links", items: [
      { label: "React", url: "https://github.com/facebook/react" },
      { label: "Vue", url: "https://github.com/vuejs/core" },
      { label: "Svelte", url: "https://github.com/sveltejs/svelte" },
    ] });
  });

  it("drops a rejected link or draft whole instead of showing its text", () => {
    expect(parseBlock({ type: "links", items: [{ label: "Phish", url: "https://evil.example/x" }] })).toBeNull();
    expect(parseBlock({ type: "whatsapp", text: "Llámame al 7123 4567 o al 71234568." })).toEqual({ type: "whatsapp", text: "Llámame al […] o al […]." });
    expect(parseBlock({ type: "whatsapp", text: "Llego a las 10 con 2 amigos." })).toEqual({ type: "whatsapp", text: "Llego a las 10 con 2 amigos." });
  });

  it("keeps a WhatsApp draft up to 500 characters and remembers it in the history", () => {
    const block = parseBlock({ type: "whatsapp", text: `Hola, ${"a".repeat(600)}` });
    expect(block?.type).toBe("whatsapp");
    expect(block && block.type === "whatsapp" ? [...block.text].length : 0).toBeLessThanOrEqual(500);
    const links: SpeechBlock = { type: "links", items: [{ label: "React", url: "https://github.com/facebook/react" }] };
    expect(historyReply({ spoken: "Listo.", blocks: [{ type: "whatsapp", text: "Llego tarde." }, links] })).toBe("Listo.\nWhatsApp: Llego tarde.");
    expect(acceptsBlock([], { type: "whatsapp", text: "x".repeat(500) })).toBe(true);
  });
});

describe("speech client with plugins", () => {
  it("sends the plugins left on and reports a tool only for one of them", async () => {
    const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      event("tool", { plugin: "whatsapp" }),
      event("tool", { plugin: "github" }),
      event("spoken", { text: "React tiene muchas estrellas." }),
      event("block", { block: { type: "links", items: [{ label: "React", url: "https://github.com/facebook/react" }] } }),
      event("done", {}),
    ].join("")));
    vi.stubGlobal("fetch", fetchMock);
    const onTool = vi.fn();
    const reply = await streamSpeechReply({
      message: "¿Estrellas de React?", language: "es", history: [], memory: [], plugins: ["github"], onTool,
      signal: new AbortController().signal, onSpoken: vi.fn(), onBlock: vi.fn(),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).plugins).toEqual(["github"]);
    expect(onTool).toHaveBeenCalledExactlyOnceWith("github");
    expect(reply.blocks).toEqual([{ type: "links", items: [{ label: "React", url: "https://github.com/facebook/react" }] }]);
  });
});

describe("plugin blocks on screen", () => {
  it("shows sources as links that open GitHub in a new tab", () => {
    render(<ReplyBlocks blocks={[{ type: "links", items: [{ label: "facebook/react", url: "https://github.com/facebook/react" }] }]} />);
    const sources = screen.getByRole("navigation", { name: "Fuentes" });
    const link = within(sources).getByRole("link", { name: /facebook\/react/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://github.com/facebook/react");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("shows the WhatsApp draft as text and opens it in WhatsApp with the whole message", () => {
    const text = "Hola, llego tarde & con hambre: ¿pedimos pizza?";
    render(<ReplyBlocks blocks={[{ type: "whatsapp", text }]} />);
    expect(screen.getByText("Mensaje para WhatsApp")).toBeTruthy();
    const open = screen.getByRole("link", { name: /Abrir en WhatsApp/ }) as HTMLAnchorElement;
    expect(new URL(open.href).origin).toBe("https://wa.me");
    expect(new URL(open.href).searchParams.get("text")).toBe(text);
    expect(open.rel).toBe("noopener noreferrer");
  });
});

describe("Ajustes › Plugins", () => {
  it("switches each plugin on and off and remembers it in this browser", () => {
    render(<SettingsPanel onClose={vi.fn()} onOpenMemory={vi.fn()} />);
    const plugins = screen.getByRole("region", { name: "Plugins" });
    const github = within(plugins).getByRole("button", { name: "GitHub" });
    const whatsapp = within(plugins).getByRole("button", { name: "WhatsApp" });
    expect(github.getAttribute("aria-pressed")).toBe("true");
    expect(whatsapp.getAttribute("aria-pressed")).toBe("true");
    expect(github.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(github.getAttribute("aria-describedby")!)?.textContent).toContain("datos públicos de GitHub");

    fireEvent.click(github);
    expect(github.getAttribute("aria-pressed")).toBe("false");
    expect(whatsapp.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("jevling.plugins")).toBe(JSON.stringify({ github: false, whatsapp: true }));
  });
});
