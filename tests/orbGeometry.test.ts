import { describe, expect, it } from "vitest";
import { particlePhase } from "../src/features/story/particleGeometry";
import { orbState } from "../src/features/story/orbGeometry";

describe("glass orb storytelling geometry", () => {
  it("is a pure function of phase and time, so scrubbing back repeats the same orb", () => {
    expect(orbState(particlePhase(2.8), 3.2)).toEqual(orbState(particlePhase(2.8), 3.2));
  });

  it("is alone and centered on the first scene, a small following lens over a project", () => {
    expect(orbState(particlePhase(0.2), 4)).toMatchObject({ x: 0, y: 0, radius: 0.3, ring: 0 });
    const lens = orbState(particlePhase(1.3), 4);
    expect(lens.radius).toBe(0.16);
    expect(lens.follow).toBe(1);
    expect(Math.hypot(lens.x, lens.y)).toBeLessThan(0.25);
  });

  it("covers the stage, centered, while the scene changes", () => {
    const covering = orbState(particlePhase(1.78), 4);
    expect(covering.radius).toBeGreaterThan(0.58);
    expect(Math.hypot(covering.x, covering.y)).toBeLessThan(0.01);
  });

  it("opens into a still ring of light around Jev", () => {
    expect(orbState(particlePhase(5), 2)).toMatchObject({ x: 0, y: 0, ring: 1, follow: 0 });
    expect(orbState(particlePhase(5), 2).radius).toBeCloseTo(0.44);
  });
});
