// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticleVortex } from "../src/features/story/ParticleVortex";

const ticker = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock("gsap", () => ({ gsap: { ticker } }));
const tokens: Record<string, string> = { count: "80", "mobile-count": "40", orbits: "4", "sample-size": "40", dot: "1.35", glow: "7", drift: "0.0018", speed: "0.2", parallax: "0.025", turns: "1.5", trail: "0.3", highlight: "0.86", contrast: "1.7", "budget-ms": "10", "min-count": "35", violet: "#A78BFA", pink: "#D946EF", white: "#F7F7FA" };
Object.assign(tokens, { "pointer-radius": "0.24", "pointer-force": "0.14", spring: "0.055", damping: "0.84", current: "0.045" });
let images: FakeImage[];
class FakeImage {
  naturalWidth = 40; naturalHeight = 40; src = "";
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { images.push(this); }
}
const context = {
  clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), setTransform: vi.fn(),
  beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), ellipse: vi.fn(), rect: vi.fn(), fill: vi.fn(),
  createRadialGradient: () => ({ addColorStop: vi.fn() }),
  getImageData: () => ({ data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }),
};
beforeEach(() => {
  images = []; vi.clearAllMocks();
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (key: string) => tokens[key.replace("--particle-", "")] ?? "" } as CSSStyleDeclaration);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 600, height: 600, left: 0, top: 0, right: 600, bottom: 600 } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("particle renderer ownership", () => {
  it("deforms near the pointer, springs back on exit and stays still with reduced motion", () => {
    const props = { progress: { current: 4 }, active: true, reduced: false, onError: vi.fn() };
    const result = render(<div><ParticleVortex {...props} /></div>);
    const draw = ticker.add.mock.calls[0][0] as (seconds: number, delta: number) => void;
    const move = new MouseEvent("pointermove", { clientX: 330, clientY: 210 });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    act(() => { window.dispatchEvent(move); for (let i = 0; i < 60; i++) draw(i / 60, 1000 / 60); });
    const node = document.querySelector("canvas")!;
    expect(Number(node.dataset.deformation)).toBeGreaterThan(0.01);
    act(() => { window.dispatchEvent(new MouseEvent("pointerout")); for (let i = 0; i < 180; i++) draw(i / 60, 1000 / 60); });
    expect(Number(node.dataset.deformation)).toBeLessThan(0.001);
    result.rerender(<div><ParticleVortex {...props} reduced /></div>);
    act(() => window.dispatchEvent(move));
    expect(node.dataset.deformation).toBe("0.0000");
    expect(node.dataset.running).toBe("false");
  });
  it("samples images once, pauses the ticker and releases resources on unmount", async () => {
    const error = vi.fn(); const progress = { current: 1 };
    const props = { progress, active: true, reduced: false, onError: error };
    const result = render(<div><ParticleVortex {...props} /></div>);
    expect(images).toHaveLength(3);
    await act(async () => { images.forEach(image => image.onload?.()); });
    expect(document.querySelector("canvas")?.dataset.prepared).toBe("true");
    expect(ticker.add).toHaveBeenCalledOnce();
    const draw = ticker.add.mock.calls[0][0] as (seconds: number, delta: number) => void;
    progress.current = 4.7;
    act(() => draw(1, 16));
    expect(Number(document.querySelector("canvas")?.dataset.reveal)).toBeGreaterThan(0);
    expect(images).toHaveLength(3);
    result.rerender(<div><ParticleVortex {...props} active={false} /></div>);
    expect(ticker.remove).toHaveBeenCalledWith(draw);
    expect(document.querySelector("canvas")?.dataset.running).toBe("false");
    result.rerender(<div><ParticleVortex {...props} reduced /></div>);
    expect(ticker.add).toHaveBeenCalledOnce();
    expect(document.querySelector("canvas")?.dataset.reveal).toBe("1.000");
    result.rerender(<div><ParticleVortex {...props} /></div>);
    expect(ticker.add).toHaveBeenCalledTimes(2);
    const node = document.querySelector("canvas")!;
    result.unmount();
    expect(node.width).toBe(0); expect(node.height).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it("reports image failure while preserving geometry and ignores completion after unmount", async () => {
    const error = vi.fn(); const progress = { current: 0 };
    const props = { progress, active: true, reduced: false, onError: error };
    const result = render(<div><ParticleVortex {...props} /></div>);
    await act(async () => { images[0].onerror?.(); images.slice(1).forEach(image => image.onload?.()); });
    expect(error).toHaveBeenCalledOnce();
    expect(document.querySelector("canvas")?.dataset.prepared).toBe("true");
    result.unmount(); error.mockClear();
    const pending = render(<div><ParticleVortex {...props} /></div>);
    pending.unmount();
    await act(async () => { images.forEach(image => image.onload?.()); });
    expect(error).not.toHaveBeenCalled();
    expect(images.every(image => image.onload === null && image.onerror === null)).toBe(true);
  });
});
