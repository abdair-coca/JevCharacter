// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPEECH_MEMORY_NOTE_MAX_CHARS, SPEECH_MEMORY_SEND_MAX, SPEECH_MEMORY_SEND_MAX_CHARS } from "../src/creature/brain/speechBlocks";
import { addMemory, clearMemory, MEMORY_NOTES_MAX, readMemory, removeMemory, selectRelevant, type MemoryNote } from "../src/creature/memory/memoryStore";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const note = (text: string, index: number): MemoryNote => ({ id: `n${index}`, text, createdAt: index });

describe("memory store", () => {
  it("keeps notes between visits, oldest first", () => {
    addMemory("Le interesa la tecnología.", 1);
    addMemory("Vive en Potosí.", 2);
    const stored = JSON.parse(window.localStorage.getItem("jevling.memory") ?? "null") as { version: number; notes: MemoryNote[] };
    expect(stored.version).toBe(1);
    expect(readMemory().map(item => item.text)).toEqual(["Le interesa la tecnología.", "Vive en Potosí."]);
  });

  it("keeps at most 40 notes, dropping the oldest", () => {
    for (let index = 0; index < MEMORY_NOTES_MAX + 3; index++) addMemory(`Nota ${index}.`, index);
    const notes = readMemory();
    expect(notes).toHaveLength(MEMORY_NOTES_MAX);
    expect(notes[0].text).toBe("Nota 3.");
    expect(notes.at(-1)?.text).toBe(`Nota ${MEMORY_NOTES_MAX + 2}.`);
  });

  it("does not store repeated, empty, oversized-then-clamped twice, or long-number notes", () => {
    addMemory("Le interesa la tecnología.");
    addMemory("le interesa la TECNOLOGIA.");
    addMemory("   ");
    addMemory("Su celular es 7123-4567.");
    addMemory("x ".repeat(SPEECH_MEMORY_NOTE_MAX_CHARS));
    const notes = readMemory();
    expect(notes.map(item => item.text)).toHaveLength(2);
    expect([...notes[1].text].length).toBeLessThanOrEqual(SPEECH_MEMORY_NOTE_MAX_CHARS);
  });

  it("forgets one note or all of them", () => {
    addMemory("Uno.", 1);
    const [first] = addMemory("Dos.", 2);
    expect(removeMemory(first.id).map(item => item.text)).toEqual(["Dos."]);
    clearMemory();
    expect(readMemory()).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("jevling.memory") ?? "null")).toEqual({ version: 1, notes: [] });
  });

  it("ignores corrupt storage and keeps working for the session when storage fails", () => {
    window.localStorage.setItem("jevling.memory", '{"version":1,"notes":[{"id":1}]}');
    expect(readMemory()).toEqual([]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => addMemory("Prefiere carreras cortas.")).not.toThrow();
    expect(readMemory().map(item => item.text)).toContain("Prefiere carreras cortas.");
  });
});

describe("relevant notes", () => {
  const notes = [
    note("Le gusta la programación y los videojuegos.", 0),
    note("Tiene un perro llamado Toby.", 1),
    note("Duda entre Informática y Diseño Gráfico.", 2),
    note("Prefiere estudiar cerca de casa.", 3),
    note("Le preocupa el costo de la universidad.", 4),
  ];

  it("sends the two latest notes plus those sharing words with the message, oldest first", () => {
    expect(selectRelevant(notes, "¿Qué carrera de informática o programación me conviene?")).toEqual([
      "Le gusta la programación y los videojuegos.",
      "Duda entre Informática y Diseño Gráfico.",
      "Prefiere estudiar cerca de casa.",
      "Le preocupa el costo de la universidad.",
    ]);
  });

  it("matches words without accents or exact endings", () => {
    expect(selectRelevant(notes, "programar en tecnologia")).toContain("Le gusta la programación y los videojuegos.");
    expect(selectRelevant(notes, "programar")).not.toContain("Tiene un perro llamado Toby.");
  });

  it("stays within the request bounds", () => {
    const many = Array.from({ length: 30 }, (_, index) => note(`Programación ${index} ${"x".repeat(140)}`, index));
    const chosen = selectRelevant(many, "programación");
    expect(chosen.length).toBeLessThanOrEqual(SPEECH_MEMORY_SEND_MAX);
    expect(chosen.reduce((total, text) => total + [...text].length, 0)).toBeLessThanOrEqual(SPEECH_MEMORY_SEND_MAX_CHARS);
    expect(chosen.at(-1)).toBe(many.at(-1)?.text);
  });

  it("sends nothing without notes", () => {
    expect(selectRelevant([], "hola")).toEqual([]);
  });
});
