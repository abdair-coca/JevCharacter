// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortraitParticles } from "../src/features/author/PortraitParticles";

const ticker = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock("gsap", () => ({ gsap: { ticker } }));
const tokens: Record<string, string> = {
  "--portrait-count": "80", "--portrait-mobile-count": "40", "--portrait-min-count": "35", "--portrait-budget-ms": "10",
  "--portrait-sample-size": "40", "--portrait-min-light": "0.22", "--portrait-extent": "0.94", "--portrait-vignette": "0.34",
  "--portrait-dot": "1.5", "--portrait-glow": "9", "--portrait-drift": "0.0016", "--portrait-speed": "0.25", "--portrait-spin": "0.35",
  "--portrait-turns": "1.25", "--portrait-gather": "1.8", "--portrait-stagger": "1.1", "--portrait-highlight": "0.74", "--portrait-contrast": "0.9",
  "--portrait-scan": "0.35", "--portrait-scan-period": "7", "--portrait-exit-span": "0.9",
  "--portrait-pointer-radius": "0.2", "--portrait-pointer-force": "0.12", "--portrait-spring": "0.06", "--portrait-damping": "0.84",
  "--particle-violet": "#A78BFA", "--particle-pink": "#D946EF", "--particle-white": "#F7F7FA",
};
let images: FakeImage[];
class FakeImage {
  naturalWidth = 40; naturalHeight = 40; src = "";
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { images.push(this); }
}
const context = {
  clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), fill: vi.fn(),
  createRadialGradient: () => ({ addColorStop: vi.fn() }),
  getImageData: () => ({ data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }),
};
let box = { width: 600, height: 600, left: 0, top: 0, right: 600, bottom: 600 };
const pointer = (type: string, pointerType: string, init: MouseEventInit = {}) => {
  const event = new MouseEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
};
const frames = (count: number) => { const draw = ticker.add.mock.calls.at(-1)![0] as (seconds: number, delta: number) => void; for (let i = 0; i < count; i++) draw(i / 60, 1000 / 60); };
const canvas = () => document.querySelector("canvas")!;

beforeEach(() => {
  images = []; vi.clearAllMocks();
  box = { width: 600, height: 600, left: 0, top: 0, right: 600, bottom: 600 };
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (key: string) => tokens[key] ?? "" } as CSSStyleDeclaration);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => box as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("particle portrait", () => {
  it("turns as a galaxy, then gathers into the photo once it is sampled", async () => {
    render(<div><PortraitParticles src="/story/Abdair.jpg" active onError={vi.fn()} /></div>);
    expect(images).toHaveLength(1);
    act(() => frames(240));
    expect(canvas().dataset.gathered).toBe("false");
    await act(async () => images[0].onload?.());
    expect(canvas().dataset.prepared).toBe("true");
    act(() => frames(60));
    expect(canvas().dataset.gathered).toBe("false");
    act(() => frames(180));
    expect(canvas().dataset.gathered).toBe("true");
  });

  it("ripples from a mouse anywhere and from a finger only on the portrait, then springs back", async () => {
    render(<div><PortraitParticles src="/story/Abdair.jpg" active onError={vi.fn()} /></div>);
    await act(async () => images[0].onload?.());
    act(() => frames(240));
    act(() => { window.dispatchEvent(pointer("pointermove", "touch", { clientX: 300, clientY: 300 })); frames(30); });
    expect(Number(canvas().dataset.deformation)).toBeLessThan(0.001);
    act(() => { canvas().parentElement!.dispatchEvent(pointer("pointerdown", "touch", { clientX: 300, clientY: 300 })); frames(30); });
    expect(Number(canvas().dataset.deformation)).toBeGreaterThan(0.01);
    act(() => { canvas().parentElement!.dispatchEvent(pointer("pointerup", "touch")); frames(240); });
    expect(Number(canvas().dataset.deformation)).toBeLessThan(0.001);
    act(() => { window.dispatchEvent(pointer("pointermove", "mouse", { clientX: 330, clientY: 210 })); frames(30); });
    expect(Number(canvas().dataset.deformation)).toBeGreaterThan(0.01);
  });

  it("dissolves as the hero scrolls away and stops its clock when inactive or unmounted", async () => {
    const result = render(<div><PortraitParticles src="/story/Abdair.jpg" active onError={vi.fn()} /></div>);
    await act(async () => images[0].onload?.());
    act(() => frames(1));
    expect(canvas().dataset.exit).toBe("0.000");
    box = { ...box, top: -600, bottom: 0 };
    act(() => frames(1));
    expect(canvas().dataset.exit).toBe("1.000");
    result.rerender(<div><PortraitParticles src="/story/Abdair.jpg" active={false} onError={vi.fn()} /></div>);
    expect(canvas().dataset.running).toBe("false");
    expect(ticker.remove).toHaveBeenCalled();
    result.unmount();
    expect(ticker.remove).toHaveBeenCalledTimes(2);
  });

  it("reports a photo that cannot load, so the page shows it plainly", async () => {
    const error = vi.fn();
    render(<div><PortraitParticles src="/story/Abdair.jpg" active onError={error} /></div>);
    await act(async () => images[0].onerror?.());
    expect(error).toHaveBeenCalledOnce();
  });
});
