import { useSyncExternalStore } from "react";
import { writeStorage } from "../../lib/storage";
import {
  parseMemoryNote,
  SPEECH_MEMORY_NOTE_MAX_CHARS,
  SPEECH_MEMORY_SEND_MAX,
  SPEECH_MEMORY_SEND_MAX_CHARS,
} from "../brain/speechBlocks";

const STORAGE_KEY = "jevling.memory";
export const MEMORY_NOTES_MAX = 40;
const RECENT_NOTES = 2;
// Words compared by their first letters, so «tecnología» meets «tecnológico».
const STEM_LENGTH = 5;
const MIN_WORD_LENGTH = 3;
const STOP_WORDS = new Set([
  "que", "para", "como", "con", "por", "una", "uno", "los", "las", "del", "pero", "mas", "esto", "esta", "este",
  "eso", "esa", "ese", "hay", "tengo", "quiero", "puedo", "sobre", "cual", "cuales", "donde", "cuando", "muy",
  "sus", "mis", "tus", "ser", "estar", "algo", "mejor", "puede", "usuario",
  "the", "and", "for", "with", "what", "which", "that", "this", "you", "your", "are", "can", "how", "about",
  "want", "have", "from", "they", "there", "would", "could", "should", "user",
]);

export type MemoryNote = { id: string; text: string; createdAt: number };
type StoredMemory = { version: 1; notes: MemoryNote[] };

/** The signed-in visitor's notes in their account, already limited to that visitor by RLS. */
export type MemoryRemote = {
  /** Oldest to newest. */
  list: () => Promise<MemoryNote[]>;
  insert: (notes: MemoryNote[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
};

/** `loading` until the account's notes arrive; `offline` when they never did or a change was not saved. */
export type MemoryStatus = "ready" | "loading" | "offline";
export type MemoryView = {
  source: "browser" | "account";
  status: MemoryStatus;
  notes: MemoryNote[];
  /** Notes this browser kept before signing in, offered for import into the account. */
  browserNotes: number;
};

type AccountMemory = {
  remote: MemoryRemote;
  notes: MemoryNote[];
  status: MemoryStatus;
  writeFailed: boolean;
  /** Kept here but not yet in the account: a reload of the account must not drop them. */
  unsaved: Set<string>;
  /** Forgotten here: a reload of the account that still has them must not bring them back. */
  forgotten: Set<string>;
  queue: Promise<void>;
};

// Signed in, the account replaces this browser's notes; signed out, it is null.
let account: AccountMemory | null = null;
let view: MemoryView | null = null;
const listeners = new Set<() => void>();

function isNote(value: unknown): value is MemoryNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<MemoryNote>;
  return typeof note.id === "string" && typeof note.createdAt === "number" && Number.isFinite(note.createdAt) &&
    typeof note.text === "string" && Boolean(note.text.trim()) && [...note.text].length <= SPEECH_MEMORY_NOTE_MAX_CHARS;
}

function isStoredMemory(value: unknown): value is StoredMemory {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredMemory>;
  return candidate.version === 1 && Array.isArray(candidate.notes) && candidate.notes.every(isNote);
}

// Without storage (private browsing, blocked site data) the notes last for this session only.
let sessionNotes: MemoryNote[] = [];

function readBrowserMemory(): MemoryNote[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return sessionNotes;
  }
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return isStoredMemory(value) ? value.notes : [];
  } catch {
    return [];
  }
}

function saveBrowserMemory(notes: MemoryNote[]) {
  sessionNotes = notes;
  writeStorage(STORAGE_KEY, { version: 1, notes } satisfies StoredMemory);
}

/** Notes from oldest to newest, from the account when signed in, else from this browser. */
export function readMemory(): MemoryNote[] {
  return account ? account.notes : readBrowserMemory();
}

function changed() {
  view = null;
  for (const listener of listeners) listener();
}

function readView(): MemoryView {
  view ??= account
    ? { source: "account", status: account.status, notes: account.notes, browserNotes: readBrowserMemory().length }
    : { source: "browser", status: "ready", notes: readBrowserMemory(), browserNotes: 0 };
  return view;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The notes the panel shows, with where they live; updates when they change or the visitor signs in or out. */
export function useMemory(): MemoryView {
  return useSyncExternalStore(subscribe, readView, readView);
}

const comparable = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const byAge = (a: MemoryNote, b: MemoryNote) => a.createdAt - b.createdAt;

function failed(current: AccountMemory, write: boolean) {
  if (account !== current) return;
  // A reload that fails keeps the notes already here; only the first load or a lost change is worth a notice.
  if (!write && current.status !== "loading") return;
  current.writeFailed ||= write;
  current.status = "offline";
  changed();
}

/** Account writes run one after another, so a note forgotten right after it was kept is gone from the account too. */
function enqueue(current: AccountMemory, write: () => Promise<void>): Promise<void> {
  const result = current.queue.then(write);
  current.queue = result.catch(() => undefined);
  return result;
}

/** Keeps a note Jev chose to remember; repeated notes are not stored twice and the oldest leave first. */
export function addMemory(text: string, now = Date.now()): MemoryNote[] {
  const note = parseMemoryNote({ type: "memory", text });
  const notes = readMemory();
  if (note === null || notes.some(existing => comparable(existing.text) === comparable(note))) return notes;
  if (!account) {
    const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [...notes, { id, text: note, createdAt: now }].slice(-MEMORY_NOTES_MAX);
    saveBrowserMemory(next);
    changed();
    return next;
  }
  // Offline, the note still counts for this session; the conversation never waits for the account.
  const current = account;
  const kept = { id: crypto.randomUUID(), text: note, createdAt: now };
  current.notes = [...notes, kept].slice(-MEMORY_NOTES_MAX);
  current.unsaved.add(kept.id);
  enqueue(current, () => current.remote.insert([kept])).then(() => current.unsaved.delete(kept.id), () => failed(current, true));
  changed();
  return current.notes;
}

/** Forgets one note; the panel is the only place where notes are removed. */
export function removeMemory(id: string): MemoryNote[] {
  if (!account) {
    const next = readBrowserMemory().filter(note => note.id !== id);
    saveBrowserMemory(next);
    changed();
    return next;
  }
  const current = account;
  current.notes = current.notes.filter(note => note.id !== id);
  current.forgotten.add(id);
  enqueue(current, () => current.remote.remove(id)).catch(() => failed(current, true));
  changed();
  return current.notes;
}

/** Signed in, forgets every note in the account, including those kept from other devices. */
export function clearMemory() {
  if (!account) {
    saveBrowserMemory([]);
    changed();
    return;
  }
  const current = account;
  for (const note of current.notes) current.forgotten.add(note.id);
  current.notes = [];
  current.unsaved.clear();
  enqueue(current, () => current.remote.clear()).catch(() => failed(current, true));
  changed();
}

function load(current: AccountMemory) {
  current.remote.list().then(notes => {
    if (account !== current) return;
    const kept = notes.filter(note => !current.forgotten.has(note.id) && !current.unsaved.has(note.id));
    const unsaved = current.notes.filter(note => current.unsaved.has(note.id));
    current.notes = [...kept, ...unsaved].sort(byAge).slice(-MEMORY_NOTES_MAX);
    current.status = current.writeFailed ? "offline" : "ready";
    changed();
  }, () => failed(current, false));
}

/** On sign-in: the account's notes replace this browser's until sign-out. */
export function connectAccountMemory(remote: MemoryRemote) {
  const current: AccountMemory = { remote, notes: [], status: "loading", writeFailed: false, unsaved: new Set(), forgotten: new Set(), queue: Promise.resolve() };
  account = current;
  changed();
  load(current);
}

/** Brings in what other devices kept or forgot since the last look. */
export function reloadAccountMemory() {
  if (account) load(account);
}

/** On sign-out: the account's notes leave this browser and its own notes come back. */
export function disconnectAccountMemory() {
  if (!account) return;
  account = null;
  changed();
}

/** Moves this browser's notes into the account; afterwards the browser keeps none, so there are never two memories. */
export async function importBrowserMemory(): Promise<boolean> {
  const current = account;
  if (!current) return false;
  const known = new Set(current.notes.map(note => comparable(note.text)));
  const moving = readBrowserMemory()
    .filter(note => !known.has(comparable(note.text)))
    .map(note => ({ ...note, id: crypto.randomUUID() }));
  try {
    if (moving.length > 0) await enqueue(current, () => current.remote.insert(moving));
  } catch {
    return false;
  }
  saveBrowserMemory([]);
  if (account === current) current.notes = [...current.notes, ...moving].sort(byAge).slice(-MEMORY_NOTES_MAX);
  changed();
  return true;
}

// Another device may have kept or forgotten notes while this tab was hidden.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reloadAccountMemory();
  });
}

function stems(text: string): Set<string> {
  return new Set(comparable(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word))
    .map(word => word.slice(0, STEM_LENGTH)));
}

/**
 * Notes to send with a message: the latest ones, then those sharing the most words with it,
 * within the request bounds. Returned from oldest to newest.
 */
export function selectRelevant(notes: MemoryNote[], message: string): string[] {
  const recent = notes.slice(-RECENT_NOTES);
  const wanted = stems(message);
  const related = notes.slice(0, -RECENT_NOTES)
    .map((note, index) => ({ note, index, score: [...stems(note.text)].filter(stem => wanted.has(stem)).length }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .map(candidate => candidate.note);

  const chosen = new Set<MemoryNote>();
  let used = 0;
  for (const note of [...recent.reverse(), ...related]) {
    if (chosen.size >= SPEECH_MEMORY_SEND_MAX) break;
    const size = [...note.text].length;
    if (used + size > SPEECH_MEMORY_SEND_MAX_CHARS) continue;
    chosen.add(note);
    used += size;
  }
  return notes.filter(note => chosen.has(note)).map(note => note.text);
}
