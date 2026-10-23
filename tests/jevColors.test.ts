import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_JEV_COLOR, JEV_COLORS, JEV_COLOR_IDS, isJevColor } from "../src/character/jevColors";
import { messages } from "../src/i18n/messages";

const tokens = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

describe("Jev's color palette", () => {
  it("defaults to the violet authored in the Rive file", () => {
    expect(DEFAULT_JEV_COLOR).toBe("violet");
    expect(JEV_COLORS.violet).toBe(0xffd044ff);
  });

  it("paints each swatch with the same opaque color sent to Rive", () => {
    for (const id of JEV_COLOR_IDS) {
      const token = tokens.match(new RegExp(`--jev-skin-${id}:\\s*#([0-9A-Fa-f]{6})`));
      expect(token, id).not.toBeNull();
      expect(JEV_COLORS[id]).toBe(0xff000000 + parseInt(token![1], 16));
    }
  });

  it("names every color in both languages", () => {
    for (const id of JEV_COLOR_IDS) {
      expect(messages.es[id]).toBeTruthy();
      expect(messages.en[id]).toBeTruthy();
    }
  });

  it("accepts only palette ids from storage", () => {
    expect(isJevColor("cyan")).toBe(true);
    expect(isJevColor("toString")).toBe(false);
    expect(isJevColor("#00C8FF")).toBe(false);
    expect(isJevColor(null)).toBe(false);
  });
});
