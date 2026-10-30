import { describe, expect, it } from "vitest";
import { particlePhase } from "../src/features/story/particleGeometry";
import { LIQUID_BALLS, LIQUID_BODY, liquidBalls } from "../src/features/story/liquidGeometry";

const field = (balls: Float32Array, x: number, y: number) => {
  let sum = 0;
  for (let i = 0; i < LIQUID_BALLS; i++) sum += balls[i * 3 + 2] ** 2 / ((x - balls[i * 3]) ** 2 + (y - balls[i * 3 + 1]) ** 2);
  return sum;
};
const distances = (balls: Float32Array) => Array.from({ length: LIQUID_BALLS }, (_, i) => Math.hypot(balls[i * 3], balls[i * 3 + 1]));

describe("liquid storytelling geometry", () => {
  it("is a pure function of phase and time, so scrubbing back repeats the same liquid", () => {
    expect(liquidBalls(particlePhase(2.8), 3.2, 1)).toEqual(liquidBalls(particlePhase(2.8), 3.2, 1));
  });

  it("holds one merged body during a scene, bounded inside the stage", () => {
    const balls = liquidBalls(particlePhase(1.3), 0, 1);
    expect(field(balls, 0, 0)).toBeGreaterThan(1);
    for (const [x, y] of [[0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5]]) expect(field(balls, x, y)).toBeLessThan(1);
  });

  it("throws droplets out of the body while changing scene", () => {
    const resting = distances(liquidBalls(particlePhase(1.3), 0, 1)).slice(LIQUID_BODY);
    const changing = distances(liquidBalls(particlePhase(1.78), 0, 1)).slice(LIQUID_BODY);
    expect(Math.max(...resting)).toBeLessThan(0.36);
    expect(Math.min(...changing)).toBeGreaterThan(0.25);
  });

  it("opens into orbiting droplets that leave the center free for Jev", () => {
    const balls = liquidBalls(particlePhase(5), 2, 1);
    expect(field(balls, 0, 0)).toBeLessThan(0.5);
    for (const distance of distances(balls)) expect(distance).toBeGreaterThan(0.38);
  });
});
