import { readStorage, removeStorage, writeStorage } from "../../lib/storage";

export type KeyStore = {
  /** The visitor's key, or null when none is saved in this browser. */
  read: () => string | null;
  /** Saves a well-formed key in this browser. Returns false, and saves nothing, when the key is malformed. */
  save: (value: string) => boolean;
  clear: () => void;
};

/** A provider key the visitor keeps in this browser only. */
export function createKeyStore(storageKey: string, parse: (value: unknown) => string | null): KeyStore {
  // Without storage (private browsing, blocked site data) the key lasts for this session only.
  let sessionKey: string | null | undefined;
  return {
    read() {
      if (sessionKey === undefined) {
        sessionKey = readStorage(storageKey, null, (value): value is string => parse(value) !== null);
      }
      return sessionKey;
    },
    save(value) {
      const key = parse(value);
      if (!key) return false;
      sessionKey = key;
      writeStorage(storageKey, key);
      return true;
    },
    clear() {
      sessionKey = null;
      removeStorage(storageKey);
    },
  };
}
