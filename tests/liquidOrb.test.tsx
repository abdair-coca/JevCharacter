// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiquidOrb } from "../src/features/story/LiquidOrb";

const ticker = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock("gsap", () => ({ gsap: { ticker } }));
const tokens: Record<string, string> = {
  texture: "40", dpr: "1.5", speed: "1", "image-scale": "0.86", lens: "0.45", dispersion: "0.06", "lens-glow": "0.35",
  spring: "0.06", damping: "0.82", stretch: "5", base: "#0B0820", pink: "#FF4FB0", blue: "#3478F6", cyan: "#5AC8FA", violet: "#A35BFF",
};
let images: FakeImage[];
class FakeImage {
  naturalWidth = 40; naturalHeight = 40; src = "";
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { images.push(this); }
}
const context2d = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
// Every WebGL call is a spy; only the status queries need real answers.
const gl = new Proxy({
  getShaderParameter: () => true, getProgramParameter: () => true, isContextLost: () => false,
  createShader: () => ({}), createProgram: () => ({}), createTexture: () => ({}), getUniformLocation: () => ({}),
} as Record<string, unknown>, {
  get(target, key: string) { return target[key] ??= vi.fn(); },
});
let webgl: unknown;
beforeEach(() => {
  images = []; vi.clearAllMocks(); webgl = gl;
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (key: string) => tokens[key.replace("--orb-", "")] ?? "" } as CSSStyleDeclaration);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 600, height: 600, left: 0, top: 0, right: 600, bottom: 600 } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) => type === "webgl2" ? webgl : context2d) as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("glass orb renderer ownership", () => {
  it("follows the pointer, springs back after it leaves and stays still with reduced motion", () => {
    const props = { progress: { current: 1.3 }, active: true, reduced: false, onError: vi.fn() };
    const result = render(<div><LiquidOrb {...props} /></div>);
    const draw = ticker.add.mock.calls[0][0] as (seconds: number, delta: number) => void;
    const move = new MouseEvent("pointermove", { clientX: 330, clientY: 210 });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    act(() => { window.dispatchEvent(move); for (let i = 0; i < 60; i++) draw(i / 60, 1000 / 60); });
    const node = document.querySelector("canvas")!;
    expect(Number(node.dataset.deformation)).toBeGreaterThan(0.01);
    act(() => { window.dispatchEvent(new MouseEvent("pointerout")); for (let i = 0; i < 180; i++) draw(i / 60, 1000 / 60); });
    expect(Number(node.dataset.deformation)).toBeLessThan(0.001);
    result.rerender(<div><LiquidOrb {...props} reduced /></div>);
    act(() => window.dispatchEvent(move));
    expect(node.dataset.deformation).toBe("0.0000");
    expect(node.dataset.running).toBe("false");
  });

  it("uploads each image once, pauses the ticker and releases resources on unmount", async () => {
    const error = vi.fn(); const progress = { current: 1 };
    const props = { progress, active: true, reduced: false, onError: error };
    const result = render(<div><LiquidOrb {...props} /></div>);
    expect(images).toHaveLength(3);
    await act(async () => { images.forEach(image => image.onload?.()); });
    expect(document.querySelector("canvas")?.dataset.prepared).toBe("true");
    expect(gl.texImage2D).toHaveBeenCalledTimes(3);
    expect(ticker.add).toHaveBeenCalledOnce();
    const draw = ticker.add.mock.calls[0][0] as (seconds: number, delta: number) => void;
    progress.current = 4.7;
    act(() => draw(1, 16));
    expect(Number(document.querySelector("canvas")?.dataset.reveal)).toBeGreaterThan(0);
    result.rerender(<div><LiquidOrb {...props} active={false} /></div>);
    expect(ticker.remove).toHaveBeenCalledWith(draw);
    expect(document.querySelector("canvas")?.dataset.running).toBe("false");
    result.rerender(<div><LiquidOrb {...props} reduced /></div>);
    expect(ticker.add).toHaveBeenCalledOnce();
    expect(document.querySelector("canvas")?.dataset.reveal).toBe("1.000");
    result.rerender(<div><LiquidOrb {...props} /></div>);
    expect(ticker.add).toHaveBeenCalledTimes(2);
    const node = document.querySelector("canvas")!;
    result.unmount();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(3);
    expect(gl.deleteProgram).toHaveBeenCalledOnce();
    expect(node.width).toBe(0); expect(node.height).toBe(0);
    expect(images).toHaveLength(3);
    expect(error).not.toHaveBeenCalled();
  });

  it("reports image failure, keeps the orb and ignores completion after unmount", async () => {
    const error = vi.fn(); const progress = { current: 0 };
    const props = { progress, active: true, reduced: false, onError: error };
    const result = render(<div><LiquidOrb {...props} /></div>);
    await act(async () => { images[0].onerror?.(); images.slice(1).forEach(image => image.onload?.()); });
    expect(error).toHaveBeenCalledOnce();
    expect(gl.texImage2D).toHaveBeenCalledTimes(2);
    expect(document.querySelector("canvas")?.dataset.prepared).toBe("true");
    result.unmount(); error.mockClear();
    const pending = render(<div><LiquidOrb {...props} /></div>);
    pending.unmount();
    await act(async () => { images.forEach(image => image.onload?.()); });
    expect(error).not.toHaveBeenCalled();
    expect(images.every(image => image.onload === null && image.onerror === null)).toBe(true);
  });

  it("falls back to the static reading without WebGL2", () => {
    webgl = null;
    const error = vi.fn();
    render(<div><LiquidOrb progress={{ current: 0 }} active reduced={false} onError={error} /></div>);
    expect(error).toHaveBeenCalledOnce();
    expect(ticker.add).not.toHaveBeenCalled();
    expect(images).toHaveLength(0);
  });
});
