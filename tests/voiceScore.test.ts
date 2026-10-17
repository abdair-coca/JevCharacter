import { describe, expect, it } from "vitest";
import { ACTION_MOTIFS, MAX_SPEECH_SECONDS, scoreSpeech } from "../src/creature/voice/voiceScore";

const last = <T,>(items: readonly T[]) => items[items.length - 1];
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

describe("speech score", () => {
  it("never voices text without words", () => {
    expect(scoreSpeech("")).toEqual([]);
    expect(scoreSpeech("... ¿? !")).toEqual([]);
  });

  it("sings each word as one continuous glide that bounces through its written syllables", () => {
    const syllables = (word: string) => scoreSpeech(word, false)[0].dips.length + 1;
    expect(scoreSpeech("Hola amigo mío", false)).toHaveLength(3);
    expect(syllables("Hola")).toBe(2);
    expect(syllables("sol")).toBe(1);
    expect(syllables("computadora")).toBe(4);
    expect(syllables("2026")).toBe(3);
    expect(syllables("canción")).toBe(2);
    // Every syllable scoops up into its note, fast, like a chirp.
    const [word] = scoreSpeech("palabra", false);
    expect(word.points.filter(point => point.snap)).toHaveLength(3);
    for (let index = 0; index < word.points.length; index += 2) expect(word.points[index].hz).toBeLessThan(word.points[index + 1].hz);
  });

  it("stresses a syllable and keeps every word's melody on a pentatonic scale", () => {
    const [word] = scoreSpeech("computadora", false);
    expect(word.accents).toEqual([0.8, 0.8, 1, 0.8]);
    // Notes of one word share their phrase contour, so they differ by scale steps.
    const scale = [-5, -3, 0, 2, 4, 7, 9, 12];
    const intervals = new Set(scale.flatMap(a => scale.map(b => a - b)));
    const notes = word.points.filter(point => !point.snap).map(point => point.hz);
    for (const note of notes) {
      const semitones = 12 * Math.log2(note / notes[0]);
      expect(Math.abs(semitones - Math.round(semitones))).toBeLessThan(1e-6);
      expect(intervals.has(Math.round(semitones))).toBe(true);
    }
  });

  it("giggles after an exclamation, brighter, quicker and softer than the word", () => {
    const [word, giggle] = scoreSpeech("¡Hola!");
    expect(scoreSpeech("¡Hola!")).toHaveLength(2);
    expect(giggle.end).toBe(word.end);
    expect(giggle.at).toBeGreaterThan(word.at + word.duration);
    expect(giggle.points[0].open).toBeGreaterThan(0.9);
    expect(giggle.duration).toBeLessThan(0.4);
    expect(giggle.gain).toBeLessThan(word.gain);
    expect(scoreSpeech("Hola.")).toHaveLength(1);
  });

  it("colours each syllable with its written vowel, from dark oo to bright ee", () => {
    const [dark, bright] = scoreSpeech("tu mi", false);
    expect(dark.points[0].open).toBeLessThan(0.2);
    expect(bright.points[0].open).toBeGreaterThan(0.9);
  });

  it("follows intonation: questions rise, statements fall, exclamations lift then settle", () => {
    const question = last(scoreSpeech("¿Estás bien?")).points;
    expect(last(question).hz).toBeGreaterThan(question[question.length - 2].hz * 1.5);
    const statement = last(scoreSpeech("Estoy bien.")).points;
    expect(last(statement).hz).toBeLessThan(statement[statement.length - 2].hz);
    const exclamation = scoreSpeech("¡Hola!");
    const calm = scoreSpeech("Hola.");
    expect(mean(exclamation[0].points.map(point => point.hz))).toBeGreaterThan(mean(calm[0].points.map(point => point.hz)));
    const bright = exclamation[0].points;
    expect(last(bright).hz).toBeLessThan(bright[bright.length - 2].hz);
  });

  it("closes an unfinished last word only when the text is complete", () => {
    expect(last(scoreSpeech("hola amigo", true)).points.length).toBeGreaterThan(last(scoreSpeech("hola amigo", false)).points.length);
  });

  it("pauses longer at commas and sentence ends than between words", () => {
    const start = (text: string) => scoreSpeech(text).find(glide => glide.end === text.length)!.at;
    expect(start("sol, mar")).toBeGreaterThan(start("sol mar"));
    expect(start("sol. mar")).toBeGreaterThan(start("sol, mar"));
  });

  it("keeps every target inside its glide and every word at a warm register", () => {
    for (const glide of scoreSpeech("¡Hola! Una pequeña criatura, muchas formas de responder. ¿Sí?")) {
      for (const point of glide.points) {
        expect(point.at).toBeGreaterThanOrEqual(0);
        expect(point.at).toBeLessThanOrEqual(1);
        expect(point.hz).toBeGreaterThan(300);
        expect(point.hz).toBeLessThan(1400);
      }
    }
  });

  it("is deterministic and tags every glide with the end of its word", () => {
    const text = "¡Hola! Una pequeña criatura, muchas formas de responder.";
    expect(scoreSpeech(text)).toEqual(scoreSpeech(text));
    const ends = [...text.matchAll(/[\p{L}\p{N}'’]+/gu)].map(match => match.index + match[0].length);
    // A giggle belongs to the word it follows.
    expect([...new Set(scoreSpeech(text).map(glide => glide.end))]).toEqual(ends);
  });

  it("caps very long replies", () => {
    const glides = scoreSpeech("palabra ".repeat(200));
    expect(glides.length).toBeGreaterThan(0);
    for (const glide of glides) expect(glide.at).toBeLessThan(MAX_SPEECH_SECONDS);
  });
});

describe("action motifs", () => {
  it("gives every visible non-talk action its own short, charismatic motif", () => {
    expect(Object.keys(ACTION_MOTIFS).sort()).toEqual(["Cloud", "Flower", "Ghost", "Hello", "bump", "no", "question", "square", "star", "think", "triangle", "yes"].sort());
    const signatures = new Set<string>();
    for (const glides of Object.values(ACTION_MOTIFS)) {
      expect(glides.length).toBeGreaterThan(0);
      for (const glide of glides) {
        for (const point of glide.points) {
          expect(point.hz).toBeGreaterThanOrEqual(200);
          expect(point.hz).toBeLessThanOrEqual(2000);
        }
        expect(glide.gain).toBeLessThanOrEqual(0.8);
      }
      expect(Math.max(...glides.map(glide => glide.at + glide.duration))).toBeLessThan(1.2);
      signatures.add(JSON.stringify(glides));
    }
    expect(signatures.size).toBe(Object.keys(ACTION_MOTIFS).length);
  });
});
