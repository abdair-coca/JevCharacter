import { createKeyStore } from "./keyStore";
import { parseGeminiKey } from "./speechProtocol";

/** The visitor's Google key for Jev's voice: it reaches only `/api/speak`, as a header. */
export const geminiKeyStore = createKeyStore("jevling.geminiKey", parseGeminiKey);
export const { read: readGeminiKey, save: saveGeminiKey, clear: clearGeminiKey } = geminiKeyStore;
