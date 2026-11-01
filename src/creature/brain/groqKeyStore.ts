import { createKeyStore } from "./keyStore";
import { parseGroqKey } from "./speechProtocol";

export const groqKeyStore = createKeyStore("jevling.groqKey", parseGroqKey);
export const { read: readGroqKey, save: saveGroqKey, clear: clearGroqKey } = groqKeyStore;
