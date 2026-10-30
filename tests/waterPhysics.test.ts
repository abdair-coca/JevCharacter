import { describe, expect, it } from "vitest";
import { createWater, DROPLETS, RIPPLES } from "../src/features/story/waterPhysics";

const run = (water: ReturnType<typeof createWater>, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 60) water.step(1 / 60); };
const buffers = () => ({ modes: new Float32Array(5), drops: new Float32Array(DROPLETS * 3), waves: new Float32Array(RIPPLES * 4) });

describe("music-driven water", () => {
  it("is still until the music touches it", () => {
    const water = createWater();
    run(water, 2);
    expect(water.energy()).toBe(0);
  });

  it("throws a droplet on a melody note that flies out, falls back and merges", () => {
    const water = createWater();
    const { modes, drops, waves } = buffers();
    water.hit({ kind: "melody", strength: 1 });
    run(water, 0.25);
    water.write(0, 0, 0.2, modes, drops, waves);
    const flying = Array.from({ length: DROPLETS }, (_, i) => drops[i * 3 + 2]).filter(radius => radius > 0);
    expect(flying).toHaveLength(1);
    const [x, y] = [drops[0], drops[1]];
    // Out past the body's edge (0.2) by more than its own size, so it reads as a separate droplet.
    expect(Math.hypot(x, y) - drops[2]).toBeGreaterThan(0.2);
    run(water, 4);
    water.write(0, 0, 0.2, modes, drops, waves);
    expect(Array.from({ length: DROPLETS }, (_, i) => drops[i * 3 + 2]).every(radius => radius === 0)).toBe(true);
  });

  it("pulses on a beat, ripples on a note and settles back to rest", () => {
    const water = createWater();
    const { modes, drops, waves } = buffers();
    water.hit({ kind: "kick", strength: 1 });
    water.hit({ kind: "note", strength: 0.8 });
    run(water, 0.05);
    water.write(0.1, 0, 0.2, modes, drops, waves);
    expect(Math.abs(modes[0])).toBeGreaterThan(0.005);
    expect(waves[3]).toBeCloseTo(0.8);
    expect(Math.hypot(waves[0] - 0.1, waves[1])).toBeLessThanOrEqual(0.2 * 0.55 + 1e-6);
    run(water, 4);
    water.write(0.1, 0, 0.2, modes, drops, waves);
    expect(Math.abs(modes[0])).toBeLessThan(0.001);
    expect(waves.every(value => value === 0)).toBe(true);
  });

  it("splashes every droplet out on an impact, and a reset stills it at once", () => {
    const water = createWater();
    const { modes, drops, waves } = buffers();
    water.hit({ kind: "impact", strength: 1.3 });
    run(water, 0.3);
    water.write(0, 0, 0.2, modes, drops, waves);
    expect(Array.from({ length: DROPLETS }, (_, i) => drops[i * 3 + 2]).every(radius => radius > 0)).toBe(true);
    expect(Math.hypot(modes[1], modes[2])).toBeGreaterThan(0.01);
    water.reset();
    expect(water.energy()).toBe(0);
  });
});
