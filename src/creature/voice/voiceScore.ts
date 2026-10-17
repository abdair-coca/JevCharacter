import type { CharacterCue } from "../../character/useCharacterController";
import type { TalkState } from "../brain/brain.types";

/**
 * A pitch target inside a glide; `open` colours its vowel, from "oo" (0) to "ee" (1).
 * A `snap` target is reached fast: the little scoop that makes a syllable bounce.
 */
export type VoicePoint = { at: number; hz: number; open?: number; snap?: true };
/**
 * One continuous, lively coo. Times are seconds from the start of its phrase;
 * points and dips are fractions of the glide, approached smoothly.
 */
export type VoiceGlide = {
  at: number;
  duration: number;
  points: readonly VoicePoint[];
  /** Quick loudness dips that bounce from one syllable to the next. */
  dips: readonly number[];
  /** Loudness of each syllable relative to `gain`, so stressed ones stand out. */
  accents?: readonly number[];
  gain: number;
  vibrato?: { rate: number; depth: number; delay: number };
};
/** A speech glide remembers where its word ends, so streamed text is voiced once. */
export type SpeechGlide = VoiceGlide & { end: number };
type Syllable = { hz: number; length: number; open?: number; accent?: number };

const PITCH = 600;
// Major pentatonic steps around the base pitch: every melody stays sing-song and in tune.
const SCALE = [-5, -3, 0, 2, 4, 7, 9, 12];
const HOME = 2;
const SYLLABLE = 0.1;
// Long and short syllables alternate, so speech bounces instead of marching.
const SWING = [1.12, 0.88];
// Each syllable scoops up into its note from a little below, like a chirp.
const SCOOP = 0.84;
const SCOOP_SECONDS = 0.02;
const WORD_GAP = 0.05;
const COMMA_PAUSE = 0.16;
const SENTENCE_PAUSE = 0.3;
const HELD = { rate: 6.5, depth: 16, delay: 0.55 };
export const MAX_SPEECH_SECONDS = 9;

const WORD = /[\p{L}\p{N}'’]+/gu;
const VOWELS = /[aeiouyáéíóúüàèìòùâêîôûäëïö]+/gu;
const VOWEL_OPEN: Record<string, number> = { u: 0.1, o: 0.25, a: 0.55, e: 0.75, i: 0.95, y: 0.95 };
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

/** Vowel colour of each written syllable (its last vowel), at most four per word. */
function syllables(word: string): number[] {
  if (/^\p{N}+$/u.test(word)) return Array.from({ length: Math.min(3, word.length) }, () => 0.55);
  const groups = word.toLowerCase().match(VOWELS) ?? ["a"];
  return groups.slice(0, 4).map(group => VOWEL_OPEN[group.normalize("NFD").replace(/\p{M}/gu, "").at(-1) ?? "a"] ?? 0.55);
}

function ending(between: string, last: boolean, complete: boolean): Ending {
  if (between.includes("?")) return "question";
  if (between.includes("!")) return "exclamation";
  if (/[.…;:]/u.test(between)) return "statement";
  if (between.includes(",")) return "comma";
  return last && complete ? "statement" : "none";
}

/** Sings syllables as one glide: each scoops into its note, with a bounce at every seam. */
function sing(notes: readonly Syllable[]) {
  const duration = notes.reduce((sum, note) => sum + note.length, 0);
  const points: VoicePoint[] = [];
  const dips: number[] = [];
  let offset = 0;
  for (const [index, { hz, length, open }] of notes.entries()) {
    if (index > 0) dips.push(offset / duration);
    points.push(
      { at: offset / duration, hz: hz * SCOOP, open, snap: true },
      { at: (offset + Math.min(SCOOP_SECONDS, length / 4)) / duration, hz },
    );
    offset += length;
  }
  return { duration, points, dips, accents: notes.map(note => note.accent ?? 1) };
}

/** A happy giggle after an exclamation: quick bright bounces that fall away. */
function giggle(roll: () => number, pitch: number): VoiceGlide {
  const count = 3 + Math.floor(roll() * 2);
  const notes = Array.from({ length: count }, (_, index) => ({
    hz: pitch * (index % 2 === 0 ? 1.5 : 1.26) * (1 - index * 0.03), length: 0.07, open: 0.95, accent: 1 - index * 0.15,
  }));
  return { at: 0, ...sing(notes), gain: 0.45 };
}

/**
 * Turns text into playful coos that follow its prosody, never its words: one bouncing
 * tone per word, a pentatonic note and vowel colour per written syllable, a lift on
 * the stressed one, a gentle fall across each sentence, a rise for questions, a bright
 * whoop and a giggle for exclamations and a soft drop when a statement closes.
 */
export function scoreSpeech(text: string, complete = true): SpeechGlide[] {
  const words = [...text.matchAll(WORD)];
  const glides: SpeechGlide[] = [];
  let at = 0;
  let inSentence = 0;
  for (const [index, match] of words.entries()) {
    const word = match[0];
    const end = match.index + word.length;
    const next = words[index + 1]?.index ?? text.length;
    const close = ending(text.slice(end, next), index === words.length - 1, complete);
    const closes = close === "question" || close === "exclamation" || close === "statement";
    const roll = random(hash(word.toLowerCase()));
    const vowels = syllables(word);
    const stressed = vowels.length === 1 ? 0 : vowels.length - 2;
    const declination = Math.max(0.88, 1 - inSentence * 0.035);
    const lift = close === "exclamation" ? 1.12 : close === "question" ? 1.05 : 1;
    let degree = HOME - 1 + Math.floor(roll() * 3);
    const notes = vowels.map((open, syllable): Syllable => {
      // Steps and small leaps keep the melody singing, never wandering off.
      if (syllable > 0) degree = Math.max(0, Math.min(SCALE.length - 3, degree + [-2, -1, 1, 2][Math.floor(roll() * 4)]));
      const last = syllable === vowels.length - 1;
      let step = degree + (syllable === stressed ? 2 : 0);
      // A question dips before it rises; an exclamation leaves room for its whoop.
      if (last && close === "question") step = Math.min(step, HOME);
      if (last && close === "exclamation") step = Math.min(step, 5);
      const length = (SYLLABLE + roll() * 0.03) * SWING[syllable % 2] * (syllable === stressed ? 1.25 : 1) * (last && closes ? 1.5 : 1);
      return { hz: PITCH * 2 ** (SCALE[step] / 12) * declination * lift, length, open, accent: syllable === stressed ? 1 : 0.8 };
    });
    const sung = sing(notes);
    const finalHz = notes[notes.length - 1].hz;
    const final = 1 - notes[notes.length - 1].length / sung.duration;
    const tail = (fraction: number) => final + (1 - final) * fraction;
    const points = [...sung.points];
    if (close === "question") points.push({ at: tail(0.5), hz: finalHz * 1.6 });
    if (close === "exclamation") points.push({ at: tail(0.45), hz: finalHz * 1.3 }, { at: tail(0.85), hz: finalHz * 1.06 });
    if (close === "statement") points.push({ at: tail(0.55), hz: finalHz * 0.8 });
    glides.push({ ...sung, at, points, end, gain: close === "exclamation" ? 0.8 : 0.7, vibrato: closes ? HELD : undefined });
    at += sung.duration;
    if (close === "exclamation") {
      const laugh = giggle(roll, PITCH * lift * declination);
      glides.push({ ...laugh, at: at + 0.05, end });
      at += 0.05 + laugh.duration;
    }
    at += closes ? SENTENCE_PAUSE : close === "comma" ? COMMA_PAUSE : WORD_GAP;
    inSentence = closes ? 0 : inSentence + 1;
  }
  return glides.filter(glide => glide.at < MAX_SPEECH_SECONDS);
}

type Note = readonly [hz: number, length: number, open: number];
/** A motif sung syllable by syllable, with the same bounce as speech. */
const coo = (at: number, notes: readonly Note[], options: { gain?: number; accents?: number[]; vibrato?: VoiceGlide["vibrato"] } = {}): VoiceGlide =>
  ({ at, ...sing(notes.map(([hz, length, open], index) => ({ hz, length, open, accent: options.accents?.[index] }))), gain: options.gain ?? 0.7, vibrato: options.vibrato });
/** A motif that slides freely through its targets, without syllables. */
const glide = (at: number, duration: number, points: readonly (readonly [number, number])[], options: { gain?: number; open?: number; vibrato?: VoiceGlide["vibrato"] } = {}): VoiceGlide =>
  ({ at, duration, points: points.map(([offset, hz], index) => index === 0 && options.open !== undefined ? { at: offset, hz, open: options.open } : { at: offset, hz }), dips: [], gain: options.gain ?? 0.7, vibrato: options.vibrato });

/** Nonsense phrasing for a talk gesture that arrives without text, e.g. from diagnostics. */
export const TALK_BABBLE: Record<TalkState, string> = {
  Talk: "bidu dabo, bee dee!",
  talkb: "tuwi da dubi bo.",
  talkc: "bi bo? dubidu!",
  talkbc: "wee bodu, ba dibi dabo.",
};

export type VoiceCue = Exclude<CharacterCue, "Base" | TalkState>;

// Notes of the D major pentatonic around Jev's voice.
const A4 = 440, D5 = 587, E5 = 659, FS5 = 740, A5 = 880, B5 = 988, D6 = 1175, FS6 = 1480, A6 = 1760;

/** Short, charismatic motifs in the same bouncy timbre, so each action is recognizable by ear. */
export const ACTION_MOTIFS: Record<VoiceCue, readonly VoiceGlide[]> = {
  Hello: [
    coo(0, [[D5, 0.1, 0.75], [A5, 0.22, 0.55]], { gain: 0.75, accents: [0.85, 1], vibrato: HELD }),
    coo(0.37, [[B5, 0.07, 0.95], [A5, 0.07, 0.95], [D6, 0.1, 0.95]], { gain: 0.42, accents: [1, 0.85, 0.75] }),
  ],
  Flower: [coo(0, [[D5, 0.1, 0.25], [FS5, 0.1, 0.55], [A5, 0.1, 0.75], [D6, 0.3, 0.95]], { gain: 0.62, accents: [0.8, 0.85, 0.9, 1], vibrato: { rate: 6.5, depth: 20, delay: 0.7 } })],
  Ghost: [glide(0, 0.75, [[0, A4], [0.35, A5], [0.75, 660], [1, 520]], { gain: 0.6, open: 0.1, vibrato: { rate: 5, depth: 40, delay: 0.15 } })],
  question: [coo(0, [[E5, 0.12, 0.1]], { gain: 0.5 }), glide(0.18, 0.34, [[0, 520], [0.25, 560], [0.8, 1000]], { gain: 0.65, open: 0.75, vibrato: { rate: 6, depth: 14, delay: 0.55 } })],
  Cloud: [glide(0, 0.9, [[0, A5], [0.5, 700], [1, 520]], { gain: 0.45, open: 0.55, vibrato: { rate: 4.5, depth: 10, delay: 0.35 } })],
  yes: [coo(0, [[E5, 0.1, 0.25], [A5, 0.2, 0.55]], { gain: 0.65, accents: [0.8, 1] })],
  no: [coo(0, [[A5, 0.12, 0.25], [E5, 0.2, 0.25]], { gain: 0.55, accents: [1, 0.85] })],
  think: [coo(0, [[E5, 0.14, 0.1], [D5, 0.14, 0.1], [FS5, 0.14, 0.1], [E5, 0.22, 0.1]], { gain: 0.42, accents: [0.9, 0.75, 0.9, 0.8] })],
  star: [
    glide(0, 0.5, [[0, D5], [0.6, D6], [1, 1319]], { gain: 0.55, open: 0.95, vibrato: { rate: 7, depth: 22, delay: 0.6 } }),
    coo(0.56, [[FS6, 0.07, 0.95], [A6, 0.1, 0.95]], { gain: 0.3 }),
  ],
  square: [coo(0, [[D5, 0.12, 0.25], [D5, 0.12, 0.25], [D5, 0.16, 0.25]], { gain: 0.55, accents: [1, 0.85, 1] })],
  triangle: [coo(0, [[A5, 0.12, 0.95], [E5, 0.12, 0.25], [A5, 0.18, 0.95]], { gain: 0.6 })],
  bump: [glide(0, 0.1, [[0, A5], [0.4, FS5]], { gain: 0.45, open: 0.25 })],
};
