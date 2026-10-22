import { readStorage, removeStorage, writeStorage } from "../../lib/storage";
import { parseGroqKey } from "./speechProtocol";

const STORAGE_KEY = "jevling.groqKey";

// Without storage (private browsing, blocked site data) the key lasts for this session only.
let sessionKey: string | null | undefined;

/** The visitor's Groq key, or null when none is saved in this browser. */
export function readGroqKey(): string | null {
  if (sessionKey === undefined) {
    sessionKey = readStorage(STORAGE_KEY, null, (value): value is string => parseGroqKey(value) !== null);
  }
  return sessionKey;
}

/** Saves a well-formed key in this browser. Returns false, and saves nothing, when the key is malformed. */
export function saveGroqKey(value: string): boolean {
  const key = parseGroqKey(value);
  if (!key) return false;
  sessionKey = key;
  writeStorage(STORAGE_KEY, key);
  return true;
}

export function clearGroqKey() {
  sessionKey = null;
  removeStorage(STORAGE_KEY);
}
