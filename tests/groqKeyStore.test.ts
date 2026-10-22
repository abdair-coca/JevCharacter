// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseGroqKey } from "../src/creature/brain/speechProtocol";

const KEY = "gsk_test_visible_key_1234567890";

// The store keeps the key in memory after the first read, so each visit starts from a fresh module.
async function visit() {
  vi.resetModules();
  return import("../src/creature/brain/groqKeyStore");
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("parseGroqKey", () => {
  it("accepts a key of visible characters and trims the spaces around it", () => {
    expect(parseGroqKey(`  ${KEY} `)).toBe(KEY);
  });

  it.each([undefined, 42, "", "corta", "con espacio dentro 1234567890", "x".repeat(201)])("rejects %s", (value) => {
    expect(parseGroqKey(value)).toBeNull();
  });
});

describe("Groq key store", () => {
  it("saves a well-formed key in this browser and reads it back", async () => {
    const store = await visit();
    expect(store.saveGroqKey(KEY)).toBe(true);
    expect(window.localStorage.getItem("jevling.groqKey")).toBe(JSON.stringify(KEY));
    expect(store.readGroqKey()).toBe(KEY);
  });

  it("keeps a malformed key out of storage", async () => {
    const store = await visit();
    expect(store.saveGroqKey("corta")).toBe(false);
    expect(window.localStorage.getItem("jevling.groqKey")).toBeNull();
    expect(store.readGroqKey()).toBeNull();
  });

  it("reads the key of an earlier visit and ignores a damaged stored value", async () => {
    window.localStorage.setItem("jevling.groqKey", JSON.stringify(KEY));
    expect((await visit()).readGroqKey()).toBe(KEY);
    window.localStorage.setItem("jevling.groqKey", JSON.stringify({ key: KEY }));
    expect((await visit()).readGroqKey()).toBeNull();
  });

  it("removes the key from storage", async () => {
    const store = await visit();
    store.saveGroqKey(KEY);
    store.clearGroqKey();
    expect(window.localStorage.getItem("jevling.groqKey")).toBeNull();
    expect(store.readGroqKey()).toBeNull();
    expect((await visit()).readGroqKey()).toBeNull();
  });

  it("keeps the key for this session when storage refuses to write", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    const store = await visit();
    expect(store.saveGroqKey(KEY)).toBe(true);
    expect(store.readGroqKey()).toBe(KEY);
  });
});
