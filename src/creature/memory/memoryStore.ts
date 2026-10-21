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

/** Notes from oldest to newest. */
export function readMemory(): MemoryNote[] {
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

function saveMemory(notes: MemoryNote[]) {
  sessionNotes = notes;
  writeStorage(STORAGE_KEY, { version: 1, notes } satisfies StoredMemory);
}

const comparable = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Keeps a note Jev chose to remember; repeated notes are not stored twice and the oldest leave first. */
export function addMemory(text: string, now = Date.now()): MemoryNote[] {
  const note = parseMemoryNote({ type: "memory", text });
  const notes = readMemory();
  if (note === null || notes.some(existing => comparable(existing.text) === comparable(note))) return notes;
  const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const next = [...notes, { id, text: note, createdAt: now }].slice(-MEMORY_NOTES_MAX);
  saveMemory(next);
  return next;
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
