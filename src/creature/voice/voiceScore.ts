import type { CharacterCue } from "../../character/useCharacterController";
import type { TalkState } from "../brain/brain.types";

/** One synthesized chirp. Times are seconds from the start of its phrase. */
export type VoiceNote = {
  at: number;
  duration: number;
  from: number;
  to: number;
  wave: OscillatorType;
  gain: number;
  vibrato?: { rate: number; depth: number };
};
/** A speech chirp remembers where its word ends, so streamed text is voiced once. */
export type SpeechNote = VoiceNote & { end: number };

const PITCH = 640;
const SYLLABLE = 0.075;
const SYLLABLE_GAP = 0.022;
const WORD_GAP = 0.07;
const COMMA_PAUSE = 0.15;
const SENTENCE_PAUSE = 0.26;
export const MAX_SPEECH_SECONDS = 9;

const WORD = /[\p{L}\p{N}'’]+/gu;
const VOWELS = /[aeiouyáéíóúüàèìòùâêîôûäëïö]+/gu;
type Ending = "question" | "exclamation" | "statement" | "comma" | "none";

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

// Same word, same melody: repetition sounds like a language without being one.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function syllables(word: string) {
  if (/^\p{N}+$/u.test(word)) return Math.min(3, word.length);
  return Math.max(1, Math.min(4, word.toLowerCase().match(VOWELS)?.length ?? 1));
}

function ending(between: string, last: boolean, complete: boolean): Ending {
  if (between.includes("?")) return "question";
  if (between.includes("!")) return "exclamation";
  if (/[.…;:]/u.test(between)) return "statement";
  if (between.includes(",")) return "comma";
  return last && complete ? "statement" : "none";
}

/**
 * Turns text into chirps that follow its prosody, never its words: one chirp per
 * written syllable, a gentle fall across each sentence, a rise for questions, a
 * bright lift for exclamations and a drop when a statement closes.
 */
export function scoreSpeech(text: string, complete = true): SpeechNote[] {
  const words = [...text.matchAll(WORD)];
  const notes: SpeechNote[] = [];
  let at = 0;
  let inSentence = 0;
  for (const [index, match] of words.entries()) {
    const word = match[0];
    const end = match.index + word.length;
    const next = words[index + 1]?.index ?? text.length;
    const close = ending(text.slice(end, next), index === words.length - 1, complete);
    const roll = random(hash(word.toLowerCase()));
    const count = syllables(word);
    const stressed = count === 1 ? 0 : count - 2;
    const declination = Math.max(0.82, 1 - inSentence * 0.035);
    const lift = close === "exclamation" ? 1.2 : close === "question" ? 1.08 : 1;
    for (let syllable = 0; syllable < count; syllable++) {
      const accent = syllable === stressed ? 1.12 : 1;
      const from = PITCH * declination * lift * accent * 2 ** (roll() * 0.5 - 0.15);
      let to = from * (1 + (roll() - 0.5) * 0.25);
      let duration = (SYLLABLE + roll() * 0.03) * (syllable === stressed ? 1.2 : 1);
      let vibrato: VoiceNote["vibrato"];
      let gain = close === "exclamation" ? 0.95 : 0.78;
      const final = syllable === count - 1;
      if (final && close === "question") { to = from * 1.75; duration *= 1.6; vibrato = { rate: 18, depth: 24 }; }
      if (final && close === "exclamation") { to = from * 1.3; duration *= 1.2; }
      if (final && close === "statement") { to = from * 0.68; duration *= 1.4; vibrato = { rate: 14, depth: 18 }; gain *= 0.9; }
      notes.push({ at, duration, from, to, wave: "sine", gain, vibrato, end });
      at += duration + SYLLABLE_GAP;
      if (final && close === "exclamation") {
        notes.push({ at, duration: 0.07, from: to, to: to * 0.72, wave: "sine", gain: gain * 0.8, end });
        at += 0.07 + SYLLABLE_GAP;
      }
    }
    at += close === "question" || close === "exclamation" || close === "statement" ? SENTENCE_PAUSE
      : close === "comma" ? COMMA_PAUSE : WORD_GAP;
    inSentence = close === "question" || close === "exclamation" || close === "statement" ? 0 : inSentence + 1;
  }
  return notes.filter(note => note.at < MAX_SPEECH_SECONDS);
}

const note = (at: number, duration: number, from: number, to = from, wave: OscillatorType = "sine", gain = 0.8, vibrato?: VoiceNote["vibrato"]): VoiceNote =>
  ({ at, duration, from, to, wave, gain, vibrato });

/** Nonsense phrasing for a talk gesture that arrives without text, e.g. from diagnostics. */
export const TALK_BABBLE: Record<TalkState, string> = {
  Talk: "bidu dabo, bee dee!",
  talkb: "tuwi da dubi bo.",
  talkc: "bi bo? dubidu!",
  talkbc: "wee bodu, ba dibi dabo.",
};

export type VoiceCue = Exclude<CharacterCue, "Base" | TalkState>;

/** Short, distinct motifs so each visible action is recognizable by ear. */
export const ACTION_MOTIFS: Record<VoiceCue, readonly VoiceNote[]> = {
  Hello: [note(0, 0.09, 700, 1100), note(0.11, 0.07, 1100, 900), note(0.21, 0.16, 900, 1500, "sine", 0.85, { rate: 16, depth: 20 })],
  Flower: [note(0, 0.07, 1047, 1047, "triangle"), note(0.08, 0.07, 1319, 1319, "triangle"), note(0.16, 0.07, 1568, 1568, "triangle"), note(0.24, 0.26, 2093, 2093, "triangle", 0.7, { rate: 12, depth: 40 })],
  Ghost: [note(0, 0.18, 300, 720, "triangle", 0.85, { rate: 7, depth: 30 }), note(0.2, 0.42, 720, 340, "triangle", 0.8, { rate: 6, depth: 45 })],
  question: [note(0, 0.12, 600, 600, "sine", 0.7), note(0.16, 0.24, 640, 1100, "sine", 0.8, { rate: 18, depth: 24 })],
  Cloud: [note(0, 0.4, 820, 520, "sine", 0.55), note(0.46, 0.45, 620, 380, "sine", 0.45, { rate: 5, depth: 12 })],
  yes: [note(0, 0.07, 880, 1000), note(0.1, 0.11, 1175, 1400)],
  no: [note(0, 0.11, 520, 420, "square", 0.32), note(0.15, 0.16, 440, 300, "square", 0.32)],
  think: [note(0, 0.05, 620), note(0.12, 0.05, 820), note(0.24, 0.05, 540), note(0.36, 0.05, 900), note(0.48, 0.05, 700)].map(value => ({ ...value, gain: 0.45 })),
  star: [note(0, 0.3, 600, 2000, "triangle", 0.7), note(0.32, 0.12, 2400, 2400, "sine", 0.4), note(0.46, 0.12, 2400, 2400, "sine", 0.3)],
  square: [note(0, 0.08, 400, 400, "square", 0.3), note(0.1, 0.08, 600, 600, "square", 0.3), note(0.2, 0.12, 400, 400, "square", 0.3)],
  triangle: [note(0, 0.16, 500, 1200, "triangle", 0.75), note(0.18, 0.16, 1200, 700, "triangle", 0.7)],
  bump: [note(0, 0.05, 900, 700, "sine", 0.5)],
};
