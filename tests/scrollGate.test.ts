import { describe, expect, it } from "vitest";
import { clampToLimit, isGatedDownwards, keyScrollsDown } from "../src/features/showcase/scrollGate";

describe("Features scroll gate", () => {
  it("blocks downward gestures from the limit, with one pixel of tolerance", () => {
    expect(isGatedDownwards(400, 400)).toBe(true);
    expect(isGatedDownwards(399, 400)).toBe(true);
    expect(isGatedDownwards(380, 400)).toBe(false);
  });

  it("pulls any overshoot back to the limit and leaves reachable positions alone", () => {
    expect(clampToLimit(420, 400)).toBe(400);
    expect(clampToLimit(400, 400)).toBeNull();
    expect(clampToLimit(120, 400)).toBeNull();
  });

  it("recognises keys that scroll downwards", () => {
    for (const key of ["ArrowDown", "PageDown", "End", " "]) expect(keyScrollsDown(key)).toBe(true);
    for (const key of ["ArrowUp", "PageUp", "Home", "a"]) expect(keyScrollsDown(key)).toBe(false);
  });
});
