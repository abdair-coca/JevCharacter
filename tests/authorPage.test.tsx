// @vitest-environment jsdom
import { LazyMotion, domAnimation } from "motion/react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthorPage from "../src/pages/AuthorPage";
import { statementWords } from "../src/features/author/catalog";
import { preferencesStore } from "../src/stores/preferencesStore";

const mocks = vi.hoisted(() => {
  const lease = { setActive: vi.fn(), release: vi.fn(), scrollTo: vi.fn() };
  return { reduced: false, inView: true, particles: [] as { active: boolean; onError: () => void }[], lease, acquire: vi.fn(() => lease) };
});
vi.mock("../src/hooks/useReducedMotionPreference", () => ({ useReducedMotionPreference: () => mocks.reduced }));
vi.mock("../src/features/presentation/useStageVisibility", () => ({ useStageVisibility: () => mocks.inView }));
vi.mock("../src/features/presentation/scrollRuntime", () => ({ acquirePresentationScroll: mocks.acquire }));
vi.mock("../src/lib/motionTokens", () => ({ useUiMotion: () => ({ duration: 0 }), useOrganicMotion: () => ({ stagger: 0, revealScale: 1 }) }));
vi.mock("../src/features/author/PortraitParticles", () => ({ PortraitParticles: (props: { active: boolean; onError: () => void }) => {
  mocks.particles.push(props);
  return <canvas data-testid="portrait-particles" data-active={props.active} />;
} }));

const view = () => <LazyMotion features={domAnimation}><AuthorPage /></LazyMotion>;
beforeEach(() => {
  mocks.reduced = false; mocks.inView = true; mocks.particles.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  preferencesStore.setState({ language: "es", theme: "dark", themePreference: "dark" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Abdair's own section", () => {
  it("greets with the approved title over the particle portrait, without any request", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(view());
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.textContent).toBe("Hola, soy Abdair.");
    expect(title.dataset.pageRoute).toBe("/abdair");
    expect(screen.getByText("Estudiante de Ingeniería Informática. Exploro la IA construyendo.")).toBeTruthy();
    expect(screen.getByTestId("portrait-particles").dataset.active).toBe("true");
    expect(mocks.lease.setActive).toHaveBeenCalledWith(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lights the interests sentence word by word and marks the three interests", () => {
    render(view());
    const sentence = screen.getByRole("region", { name: "INTERESES" });
    expect(sentence.textContent).toContain("Me interesan la inteligencia artificial, el desarrollo de software y las interfaces interactivas.");
    expect([...sentence.querySelectorAll(".author-word--key")].map(word => word.textContent).join(" ")).toBe("inteligencia artificial, desarrollo de software interfaces interactivas.");
    expect(statementWords("a [b c] d")).toEqual([{ text: "a", key: false }, { text: "b", key: true }, { text: "c", key: true }, { text: "d", key: false }]);
  });

  it("opens each project from the story apart, and Jev at home", () => {
    render(view());
    const projects = screen.getByRole("region", { name: "Aprendo construyendo." });
    const links = [...projects.querySelectorAll("a")];
    expect(links.map(link => link.getAttribute("href"))).toEqual(["https://github.com/abdair-coca/Robotsito", "https://titiedu.vercel.app", "https://machine-learning-app-gilt.vercel.app", "/"]);
    for (const link of links.slice(0, 3)) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "Ver proyecto: Bob" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "machine-learning-App" })).toBeTruthy();
    fireEvent.click(links[3]);
    expect(window.location.pathname).toBe("/");
  });

  it("tags each project with the technologies the story names, in the chosen language", () => {
    render(view());
    const tags = (name: string, label: string) => [...within(screen.getByRole("heading", { name }).closest("article")!).getByRole("list", { name: label }).querySelectorAll("li")].map(tag => tag.textContent);
    expect(tags("TitiEdu", "Tecnologías")).toEqual(["POO", "IA", "RAG", "HTML/CSS/JS"]);
    expect(tags("Jev", "Tecnologías")).toEqual(["Rive", "React", "IA"]);
    act(() => preferencesStore.getState().setLanguage("en"));
    expect(tags("Bob", "Technologies")).toEqual(["AI", "Face tracking", "Persistent memory"]);
  });

  it("shows the photo and only the networks that already have an address", () => {
    render(view());
    const list = screen.getByRole("list", { name: "Me encuentras en" });
    const links = [...list.querySelectorAll("a")];
    // X has no address yet, so it is not drawn.
    expect(links.map(link => link.dataset.contact)).toEqual(["github", "linkedin", "instagram", "tiktok"]);
    expect(links[0].getAttribute("href")).toBe("https://github.com/abdair-coca");
    expect(links[0].textContent).toContain("abdair-coca");
    for (const link of links) expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("img", { name: "Abdair Coca" }).getAttribute("src")).toBe("/story/Abdair.jpg");
  });

  it("switches language in place and links back to the story", () => {
    render(view());
    act(() => preferencesStore.getState().setLanguage("en"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hi, I'm Abdair.");
    expect(screen.getByRole("list", { name: "You can find me on" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Read Jev's story/ }).getAttribute("href")).toBe("/about");
  });

  it("pauses the portrait offscreen and falls back to the photo with reduced motion or a failed canvas", () => {
    const result = render(view());
    mocks.inView = false; result.rerender(view());
    expect(screen.getByTestId("portrait-particles").dataset.active).toBe("false");
    act(() => mocks.particles.at(-1)!.onError());
    expect(screen.queryByTestId("portrait-particles")).toBeNull();
    expect(screen.getAllByRole("img", { name: "Abdair Coca" })).toHaveLength(2);
    cleanup();
    expect(mocks.lease.release).toHaveBeenCalledOnce();
    mocks.acquire.mockClear();
    mocks.reduced = true;
    render(view());
    expect(screen.queryByTestId("portrait-particles")).toBeNull();
    expect(document.querySelector(".author-page")?.getAttribute("data-static")).toBe("true");
    // The static reading keeps native scrolling.
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
});
