import test from "node:test";
import assert from "node:assert/strict";
import { extractBlackMatte } from "../visual/phase1/web/matte.mjs";

test("dark sphere interior remains opaque while connected exterior black disappears", () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  extractBlackMatte(pixels, 3, 1, 1.5, 0.5, 0.49);
  assert.deepEqual([...pixels], [0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0]);
});

test("exterior glow reconstructs the source RGB over black within one byte", () => {
  const source = [32, 12, 80, 255];
  const pixels = new Uint8ClampedArray(source);
  extractBlackMatte(pixels, 1, 1, -100, -100, 1);
  for (let channel = 0; channel < 3; channel += 1) {
    assert.ok(Math.abs(Math.round(pixels[channel] * pixels[3] / 255) - source[channel]) <= 1);
  }
  assert.equal(pixels[3], 80);
});

test("source eye and highlights within the measured sphere are untouched", () => {
  const source = new Uint8ClampedArray([255, 245, 252, 255]);
  assert.deepEqual(extractBlackMatte(source.slice(), 1, 1, 0.5, 0.5, 2), source);
});
