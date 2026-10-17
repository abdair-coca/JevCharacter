// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StillImage } from "../src/features/story/StillImage";

class FakeImage {
  static last: FakeImage | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 320;
  naturalHeight = 200;
  src = "";
  constructor() { FakeImage.last = this; }
}
let reveal: (visible: boolean) => void = () => {};

beforeEach(() => {
  FakeImage.last = null;
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { reveal = visible => callback([{ isIntersecting: visible }]); }
    observe() {}
    disconnect() {}
  });
});
afterEach(cleanup);

describe("static reading of animated images", () => {
  it("loads only near the viewport and paints a single still frame with the caption as its name", () => {
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
    render(<StillImage src="/story/curiousTiti.webp" alt="TitiEdu · Curiosidad en cada paso" />);
    const canvas = screen.getByRole("img", { name: "TitiEdu · Curiosidad en cada paso" }) as HTMLCanvasElement;
    expect(FakeImage.last?.src).toBe("");
    act(() => reveal(false));
    expect(FakeImage.last?.src).toBe("");
    act(() => reveal(true));
    expect(FakeImage.last?.src).toBe("/story/curiousTiti.webp");
    act(() => FakeImage.last?.onload?.());
    expect([canvas.width, canvas.height]).toEqual([320, 200]);
    expect(draw).toHaveBeenCalledOnce();
  });

  it("removes itself when the image cannot load, leaving the visible caption", () => {
    render(<StillImage src="/missing.webp" alt="Caption" />);
    act(() => reveal(true));
    act(() => FakeImage.last?.onerror?.());
    expect(screen.queryByRole("img")).toBeNull();
  });
});
