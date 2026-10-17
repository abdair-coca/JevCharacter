import { describe, expect, it } from "vitest";
import { ACTION_MOTIFS, MAX_SPEECH_SECONDS, scoreSpeech } from "../src/creature/voice/voiceScore";

const last = <T,>(items: T[]) => items[items.length - 1];
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

describe("speech score", () => {
  it("never voices text without words", () => {
    expect(scoreSpeech("")).toEqual([]);
    expect(scoreSpeech("... ¿? !")).toEqual([]);
  });

  it("chirps once per written syllable, bounded per word", () => {
    expect(scoreSpeech("Hola")).toHaveLength(2);
    expect(scoreSpeech("sol")).toHaveLength(1);
    expect(scoreSpeech("computadora")).toHaveLength(4);
    expect(scoreSpeech("2026")).toHaveLength(3);
    expect(scoreSpeech("canción")).toHaveLength(2);
  });

  it("follows intonation: questions rise, statements fall, exclamations lift", () => {
    const question = last(scoreSpeech("¿Estás bien?"));
    expect(question.to).toBeGreaterThan(question.from * 1.5);
    const statement = last(scoreSpeech("Estoy bien."));
    expect(statement.to).toBeLessThan(statement.from);
    const exclamation = scoreSpeech("¡Hola!");
    const calm = scoreSpeech("Hola.");
    expect(mean(exclamation.map(note => note.from))).toBeGreaterThan(mean(calm.map(note => note.from)));
    expect(last(exclamation).to).toBeLessThan(last(exclamation).from);
  });

  it("closes an unfinished last word only when the text is complete", () => {
    expect(last(scoreSpeech("hola amigo", true)).to).toBeLessThan(last(scoreSpeech("hola amigo", false)).to);
  });

  it("pauses longer at commas and sentence ends than between words", () => {
    const start = (text: string) => scoreSpeech(text).find(note => note.end === text.length)!.at;
    expect(start("sol, mar")).toBeGreaterThan(start("sol mar"));
    expect(start("sol. mar")).toBeGreaterThan(start("sol, mar"));
  });

  it("is deterministic and tags every chirp with the end of its word", () => {
    const text = "¡Hola! Una pequeña criatura, muchas formas de responder.";
    expect(scoreSpeech(text)).toEqual(scoreSpeech(text));
    const ends = new Set([...text.matchAll(/[\p{L}\p{N}'’]+/gu)].map(match => match.index + match[0].length));
    for (const note of scoreSpeech(text)) expect(ends.has(note.end)).toBe(true);
  });

  it("caps very long replies", () => {
    const notes = scoreSpeech("palabra ".repeat(200));
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note.at).toBeLessThan(MAX_SPEECH_SECONDS);
  });
});

describe("action motifs", () => {
  it("gives every visible non-talk action its own short, audible motif", () => {
    expect(Object.keys(ACTION_MOTIFS).sort()).toEqual(["Cloud", "Flower", "Ghost", "Hello", "bump", "no", "question", "square", "star", "think", "triangle", "yes"].sort());
    const signatures = new Set<string>();
    for (const notes of Object.values(ACTION_MOTIFS)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        expect(Math.min(note.from, note.to)).toBeGreaterThanOrEqual(200);
        expect(Math.max(note.from, note.to)).toBeLessThanOrEqual(2600);
        expect(note.gain).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...notes.map(note => note.at + note.duration))).toBeLessThan(1.2);
      signatures.add(JSON.stringify(notes));
    }
    expect(signatures.size).toBe(Object.keys(ACTION_MOTIFS).length);
  });
});
