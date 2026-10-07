import { describe, expect, it } from "vitest";
import { cssDurationSeconds } from "../src/lib/motionTokens";

describe("CSS duration adapter", () => {
  it.each([["280ms", 0.28], [".28s", 0.28], ["0s", 0], [" 160ms ", 0.16]])("converts %s to Motion seconds", (value, seconds) => {
    expect(cssDurationSeconds(value)).toBe(seconds);
  });
  it("rejects unitless values rather than guessing the unit", () => {
    expect(() => cssDurationSeconds("280")).toThrow("Invalid CSS duration token");
  });
});
