import { describe, expect, it } from "vitest";
import { particlePhase, samplePixels, starGeometry, vortexPoint } from "../src/features/story/particleGeometry";

describe("particle storytelling geometry", () => {
  it("holds the star before opening and is reversible without accumulated state", () => {
    const sequence = [0, 1.2, 2.8, 3.9, 4.3, 4.7, 5];
    const forward = sequence.map(particlePhase);
    expect([...sequence].reverse().map(particlePhase).reverse()).toEqual(forward);
    expect(particlePhase(4.3)).toMatchObject({ scene: 4, morph: 0, reveal: 0 });
    expect(particlePhase(4.7).reveal).toBeGreaterThan(0);
    expect(particlePhase(5).reveal).toBe(1);
    expect(particlePhase(1.4).morph).toBe(0);
    expect(particlePhase(1.9).morph).toBeGreaterThan(0.8);
  });

  it("generates a bounded, repeatable five-point star with a reinforced contour", () => {
    const points = starGeometry(3000);
    expect(points).toEqual(starGeometry(3000));
    for (const point of points) expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(0.411);
    for (let tip = 0; tip < 5; tip++) {
      const angle = tip * Math.PI * 2 / 5 - Math.PI / 2;
      expect(points.some(point => Math.hypot(point.x - Math.cos(angle) * 0.41, point.y - Math.sin(angle) * 0.41) < 0.035)).toBe(true);
    }
  });

  it("excludes transparent/background pixels without discarding luminous details", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 0, 220, 220, 220, 255, 15, 23, 42, 255]);
    const points = samplePixels(pixels, 2, 2, 0.8, 0.8, 0.14);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ x: -0.4, y: 0.4 });
  });

  it("lands exactly on both images after a vortex transition", () => {
    const from = { x: -0.2, y: 0.3, light: 0.5 }; const to = { x: 0.1, y: -0.1, light: 0.9 };
    expect(vortexPoint(from, to, 0, 37, 1.5)).toEqual(from);
    const end = vortexPoint(from, to, 1, 37, 1.5);
    expect(end.x).toBeCloseTo(to.x); expect(end.y).toBeCloseTo(to.y); expect(end.light).toBe(to.light);
    const middle = vortexPoint(from, to, 0.5, 37, 1.5);
    expect(Math.hypot(middle.x - (from.x + to.x) / 2, middle.y - (from.y + to.y) / 2)).toBeGreaterThan(0.1);
  });
});
