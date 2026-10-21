// Typed catalog of the structured blocks Jev may add to a spoken reply. The model only
// fills this catalog; server and client normalize every block with the same functions.

export const SPEECH_SPOKEN_MAX_CHARS = 120;
export const SPEECH_BLOCKS_MAX = 6;
export const SPEECH_BLOCKS_MAX_CHARS = 750;
export const SPEECH_HISTORY_REPLY_MAX_CHARS = 600;
// Persistent memory: one hidden note per reply, and a bounded selection sent with each message.
export const SPEECH_MEMORY_NOTE_MAX_CHARS = 160;
export const SPEECH_MEMORY_SEND_MAX = 8;
export const SPEECH_MEMORY_SEND_MAX_CHARS = 1_000;

const PARAGRAPH_MAX_CHARS = 320;
const EMPHASIS_MAX = 3;
const EMPHASIS_MAX_CHARS = 40;
const ITEMS_MIN = 2;
const ITEMS_MAX = 6;
const ITEM_MAX_CHARS = 120;
const COLUMNS_MIN = 2;
const COLUMNS_MAX = 3;
const COLUMN_TITLE_MAX_CHARS = 40;
const COLUMN_POINTS_MAX = 4;
const COLUMN_POINT_MAX_CHARS = 90;
const HIGHLIGHT_VALUE_MAX_CHARS = 24;
const HIGHLIGHT_LABEL_MAX_CHARS = 80;
const CALLOUT_MAX_CHARS = 200;
const CHIPS_MAX = 3;
const CHIP_MAX_CHARS = 60;
const OBJECT_MAX_CHARS = 4_000;
// Seven or more digits, even with spaces, dots or dashes: phone, ID or account numbers.
const LONG_NUMBER = /\d(?:[\s.-]?\d){6,}/u;

export type CalloutTone = "tip" | "warning";
export type CompareColumn = { title: string; points: string[] };
export type SpeechBlock =
  | { type: "paragraph"; text: string; emphasis?: string[] }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "compare"; columns: CompareColumn[] }
  | { type: "highlight"; value: string; label: string }
  | { type: "callout"; tone: CalloutTone; text: string }
  | { type: "chips"; items: string[] };
export type SpeechReply = { spoken: string; blocks: SpeechBlock[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const length = (text: string) => [...text].length;

/** Collapses whitespace and cuts long text at a word boundary with an ellipsis. */
export function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/gu, " ").trim();
  if (length(text) <= max) return text;
  const cut = [...text].slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.trimEnd().replace(/[\s,;:.]+$/u, "")}…`;
}

// Models often number items or pack several into one string; one item per entry, no markers.
function cleanItems(value: unknown, max: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap(item => typeof item === "string" ? item.split(/\n+/u) : [])
    .map(item => clampText(item.replace(/^\s*(?:\d{1,2}[.)]|[-•*–])\s+/u, ""), maxChars))
    .filter(Boolean)
    .slice(0, max);
}

function paragraph(text: string, emphasis: unknown): SpeechBlock {
  const marked = cleanItems(emphasis, EMPHASIS_MAX, EMPHASIS_MAX_CHARS).filter(phrase => text.includes(phrase));
  return marked.length > 0 ? { type: "paragraph", text, emphasis: marked } : { type: "paragraph", text };
}

function normalizeKnown(value: Record<string, unknown>): SpeechBlock | null {
  switch (value.type) {
    case "paragraph": {
      const text = clampText(value.text, PARAGRAPH_MAX_CHARS);
      return text ? paragraph(text, value.emphasis) : null;
    }
    case "list":
    case "steps": {
      const items = cleanItems(value.items, ITEMS_MAX, ITEM_MAX_CHARS);
      return items.length >= ITEMS_MIN ? { type: value.type, items } : null;
    }
    case "compare": {
      const columns = (Array.isArray(value.columns) ? value.columns : [])
        .flatMap(column => {
          if (!isRecord(column)) return [];
          const title = clampText(column.title, COLUMN_TITLE_MAX_CHARS);
          const points = cleanItems(column.points, COLUMN_POINTS_MAX, COLUMN_POINT_MAX_CHARS);
          return title && points.length > 0 ? [{ title, points }] : [];
        })
        .slice(0, COLUMNS_MAX);
      return columns.length >= COLUMNS_MIN ? { type: "compare", columns } : null;
    }
    case "highlight": {
      const highlightValue = clampText(value.value, HIGHLIGHT_VALUE_MAX_CHARS);
      const label = clampText(value.label, HIGHLIGHT_LABEL_MAX_CHARS);
      return highlightValue && label ? { type: "highlight", value: highlightValue, label } : null;
    }
    case "callout": {
      const text = clampText(value.text, CALLOUT_MAX_CHARS);
      return text ? { type: "callout", tone: value.tone === "warning" ? "warning" : "tip", text } : null;
    }
    case "chips": {
      const items = cleanItems(value.items, CHIPS_MAX, CHIP_MAX_CHARS);
      return items.length > 0 ? { type: "chips", items } : null;
    }
    default:
      return null;
  }
}

// Readable strings of a malformed block, in field order, for the paragraph fallback.
function collectText(value: unknown, depth = 0): string[] {
  if (typeof value === "string") return [value];
  if (depth > 3) return [];
  if (Array.isArray(value)) return value.flatMap(item => collectText(item, depth + 1));
  if (!isRecord(value)) return [];
  return ["title", "value", "label", "text", "items", "points", "columns"].flatMap(key => collectText(value[key], depth + 1));
}

/** Normalizes one block. A malformed block with readable text becomes a paragraph. */
export function parseBlock(value: unknown): SpeechBlock | null {
  // A memory note is never shown, not even when it is rejected.
  if (!isRecord(value) || value.type === "memory") return null;
  const known = normalizeKnown(value);
  if (known) return known;
  const text = clampText(collectText(value).join(" "), PARAGRAPH_MAX_CHARS);
  return text ? { type: "paragraph", text } : null;
}

/** The sentence Jev says aloud, from the first object of a reply. */
export function parseSpoken(value: unknown): string | null {
  if (!isRecord(value) || value.type !== "spoken") return null;
  return clampText(value.text, SPEECH_SPOKEN_MAX_CHARS) || null;
}

/** The note Jev keeps about the user, from a hidden memory object; long numbers are never kept. */
export function parseMemoryNote(value: unknown): string | null {
  if (!isRecord(value) || value.type !== "memory") return null;
  const text = clampText(value.text, SPEECH_MEMORY_NOTE_MAX_CHARS);
  return text && !LONG_NUMBER.test(text) ? text : null;
}

function blockStrings(block: SpeechBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "callout":
      return [block.text];
    case "list":
    case "steps":
    case "chips":
      return block.items;
    case "compare":
      return block.columns.flatMap(column => [column.title, ...column.points]);
    case "highlight":
      return [block.value, block.label];
  }
}

/** Whether a reply still has room for this block. */
export function acceptsBlock(accepted: SpeechBlock[], block: SpeechBlock) {
  if (accepted.length >= SPEECH_BLOCKS_MAX) return false;
  const used = accepted.flatMap(blockStrings).reduce((total, text) => total + length(text), 0);
  return used + blockStrings(block).reduce((total, text) => total + length(text), 0) <= SPEECH_BLOCKS_MAX_CHARS;
}

/** Plain-text digest of the visible blocks; suggestions are left out. */
export function summarizeBlocks(blocks: SpeechBlock[]): string {
  return blocks.flatMap(block => {
    switch (block.type) {
      case "paragraph":
      case "callout":
        return [block.text];
      case "list":
      case "steps":
        return [block.items.join("; ")];
      case "compare":
        return [block.columns.map(column => `${column.title}: ${column.points.join(", ")}`).join(" | ")];
      case "highlight":
        return [`${block.label}: ${block.value}`];
      case "chips":
        return [];
    }
  }).join(" ");
}

/** History entry for a reply: the spoken sentence, then a bounded digest on the next line. */
export function historyReply({ spoken, blocks }: SpeechReply): string {
  const digest = clampText(summarizeBlocks(blocks), SPEECH_HISTORY_REPLY_MAX_CHARS - length(spoken) - 1);
  return digest ? `${spoken}\n${digest}` : spoken;
}

/** Splits a history entry back into its spoken sentence and digest. */
export function splitHistoryReply(assistant: string): { spoken: string; digest: string } {
  const newline = assistant.indexOf("\n");
  if (newline < 0) return { spoken: assistant.trim(), digest: "" };
  return { spoken: assistant.slice(0, newline).trim(), digest: assistant.slice(newline + 1).trim() };
}

/**
 * Extracts consecutive top-level JSON objects from streamed text. Line breaks, arrays,
 * fences or prose between objects are ignored; an oversized object is an error.
 */
export function createJsonObjectScanner() {
  let current = "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  return {
    push(chunk: string): string[] {
      const objects: string[] = [];
      for (const character of chunk) {
        if (depth === 0) {
          if (character !== "{") continue;
          current = "";
        }
        current += character;
        if (current.length > OBJECT_MAX_CHARS) throw new Error("Oversized speech object");
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === "\"") inString = false;
        } else if (character === "\"") {
          inString = true;
        } else if (character === "{") {
          depth++;
        } else if (character === "}") {
          depth--;
          if (depth === 0) objects.push(current);
        }
      }
      return objects;
    },
  };
}
