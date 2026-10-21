import { describe, expect, it } from "vitest";

import {
  acceptsBlock,
  clampText,
  createJsonObjectScanner,
  historyReply,
  parseBlock,
  parseSpoken,
  SPEECH_BLOCKS_MAX,
  SPEECH_HISTORY_REPLY_MAX_CHARS,
  splitHistoryReply,
  summarizeBlocks,
  type SpeechBlock,
} from "../src/creature/brain/speechBlocks";

const chars = (text: string) => [...text].length;

describe("speech blocks", () => {
  it("acota texto por palabra con elipsis y conserva el texto corto", () => {
    expect(clampText("  hola \n  mundo ", 20)).toBe("hola mundo");
    const clamped = clampText("palabra ".repeat(30), 40);
    expect(chars(clamped)).toBeLessThanOrEqual(40);
    expect(clamped.endsWith("palabra…")).toBe(true);
    expect(clampText(clamped, 40)).toBe(clamped);
    expect(clampText(42, 40)).toBe("");
  });

  it("normaliza cada tipo del catálogo", () => {
    expect(parseBlock({ type: "paragraph", text: "La luz llega.", emphasis: ["luz", "ausente"] }))
      .toEqual({ type: "paragraph", text: "La luz llega.", emphasis: ["luz"] });
    expect(parseBlock({ type: "steps", items: ["1. Uno", "2) Dos\n3. Tres"], max_chars: 800 }))
      .toEqual({ type: "steps", items: ["Uno", "Dos", "Tres"] });
    expect(parseBlock({ type: "list", items: Array.from({ length: 8 }, (_, index) => `- Ítem ${index}`) }))
      .toEqual({ type: "list", items: ["Ítem 0", "Ítem 1", "Ítem 2", "Ítem 3", "Ítem 4", "Ítem 5"] });
    expect(parseBlock({ type: "compare", columns: [{ title: "Gatos", points: ["Independientes"] }, { title: "Perros", points: ["Leales", 3] }, { title: "" }] }))
      .toEqual({ type: "compare", columns: [{ title: "Gatos", points: ["Independientes"] }, { title: "Perros", points: ["Leales"] }] });
    expect(parseBlock({ type: "highlight", value: "Júpiter", label: "El más grande" }))
      .toEqual({ type: "highlight", value: "Júpiter", label: "El más grande" });
    expect(parseBlock({ type: "callout", tone: "danger", text: "Cuidado." }))
      .toEqual({ type: "callout", tone: "tip", text: "Cuidado." });
    expect(parseBlock({ type: "chips", items: ["¿Uno?", "¿Dos?", "¿Tres?", "¿Cuatro?"] }))
      .toEqual({ type: "chips", items: ["¿Uno?", "¿Dos?", "¿Tres?"] });
  });

  it("convierte bloques inválidos con texto en párrafo y descarta los vacíos", () => {
    expect(parseBlock({ type: "list", items: ["Solo uno"] })).toEqual({ type: "paragraph", text: "Solo uno" });
    expect(parseBlock({ type: "chart", title: "Ventas", value: "10" })).toEqual({ type: "paragraph", text: "Ventas 10" });
    expect(parseBlock({ type: "spoken", text: "Otra frase." })).toEqual({ type: "paragraph", text: "Otra frase." });
    expect(parseBlock({ type: "list", items: [] })).toBeNull();
    expect(parseBlock({ type: "html", html: "<script>x</script>" })).toBeNull();
    expect(parseBlock("texto")).toBeNull();
    expect(parseBlock(null)).toBeNull();
  });

  it("solo acepta la frase hablada como primer objeto, acotada", () => {
    expect(parseSpoken({ type: "spoken", text: " Hola. " })).toBe("Hola.");
    expect(chars(parseSpoken({ type: "spoken", text: "a ".repeat(100) }) ?? "")).toBeLessThanOrEqual(120);
    expect(parseSpoken({ type: "paragraph", text: "Hola." })).toBeNull();
    expect(parseSpoken({ type: "spoken", text: "   " })).toBeNull();
  });

  it("limita la respuesta a seis bloques y al total de caracteres", () => {
    const short: SpeechBlock = { type: "paragraph", text: "Corto." };
    expect(acceptsBlock(Array.from({ length: SPEECH_BLOCKS_MAX - 1 }, () => short), short)).toBe(true);
    expect(acceptsBlock(Array.from({ length: SPEECH_BLOCKS_MAX }, () => short), short)).toBe(false);
    const long: SpeechBlock = { type: "paragraph", text: "x".repeat(320) };
    expect(acceptsBlock([long, long], long)).toBe(false);
    expect(acceptsBlock([long, long], short)).toBe(true);
  });

  it("resume los bloques para el historial sin sugerencias y lo separa de nuevo", () => {
    const blocks: SpeechBlock[] = [
      { type: "steps", items: ["Uno", "Dos"] },
      { type: "highlight", value: "8", label: "Planetas" },
      { type: "chips", items: ["¿Más?"] },
    ];
    expect(summarizeBlocks(blocks)).toBe("Uno; Dos Planetas: 8");
    const entry = historyReply({ spoken: "Te cuento.", blocks });
    expect(entry).toBe("Te cuento.\nUno; Dos Planetas: 8");
    expect(splitHistoryReply(entry)).toEqual({ spoken: "Te cuento.", digest: "Uno; Dos Planetas: 8" });
    expect(historyReply({ spoken: "Hola.", blocks: [] })).toBe("Hola.");
    expect(splitHistoryReply("Hola.")).toEqual({ spoken: "Hola.", digest: "" });
    const long = historyReply({ spoken: "Frase.", blocks: Array.from({ length: 6 }, () => ({ type: "paragraph", text: "y ".repeat(150) })) });
    expect(chars(long)).toBeLessThanOrEqual(SPEECH_HISTORY_REPLY_MAX_CHARS);
  });
});

describe("Jev's questions", () => {
  it("normaliza la pregunta con 2 a 5 opciones cortas", () => {
    expect(parseBlock({ type: "choices", question: "¿Qué te atrae más?", options: ["1. Programar", "- Diseñar", "Analizar datos", "Enseñar", "Investigar", "Vender"] }))
      .toEqual({ type: "choices", question: "¿Qué te atrae más?", options: ["Programar", "Diseñar", "Analizar datos", "Enseñar", "Investigar"] });
    const clamped = parseBlock({ type: "choices", question: "¿Cuál?", options: ["x ".repeat(40), "Corta"] });
    expect(clamped?.type === "choices" && chars(clamped.options[0])).toBeLessThanOrEqual(40);
  });

  it("convierte en párrafo una pregunta con menos de dos opciones", () => {
    expect(parseBlock({ type: "choices", question: "¿Te gusta?", options: ["Sí"] })).toEqual({ type: "paragraph", text: "¿Te gusta? Sí" });
    expect(parseBlock({ type: "choices", question: "", options: [] })).toBeNull();
  });

  it("no acepta bloques después de la pregunta", () => {
    const choices: SpeechBlock = { type: "choices", question: "¿Cuál?", options: ["A", "B"] };
    const short: SpeechBlock = { type: "paragraph", text: "Corto." };
    expect(acceptsBlock([short], choices)).toBe(true);
    expect(acceptsBlock([choices], short)).toBe(false);
    expect(acceptsBlock([choices], choices)).toBe(false);
  });

  it("guarda la pregunta y sus opciones en el historial", () => {
    expect(summarizeBlocks([{ type: "choices", question: "¿Qué te atrae más?", options: ["Programar", "Diseñar"] }]))
      .toBe("¿Qué te atrae más? (Programar / Diseñar)");
  });
});

describe("JSON object scanner", () => {
  it("extrae objetos pegados, partidos entre chunks y con llaves dentro de cadenas", () => {
    const scanner = createJsonObjectScanner();
    const text = '```json\n[{"type":"spoken","text":"Usa {x} y \\"y\\"."}{"type":"list","items":["a","b"]},\n{"type":"chips","items":["¿c?"]}]```';
    const objects = [...text].reduce<string[]>((found, character) => [...found, ...scanner.push(character)], []);
    expect(objects.map(object => JSON.parse(object))).toEqual([
      { type: "spoken", text: 'Usa {x} y "y".' },
      { type: "list", items: ["a", "b"] },
      { type: "chips", items: ["¿c?"] },
    ]);
  });

  it("ignora prosa fuera de objetos y rechaza un objeto desmedido", () => {
    expect(createJsonObjectScanner().push("Hola, sin JSON.")).toEqual([]);
    expect(() => createJsonObjectScanner().push(`{"text":"${"x".repeat(5_000)}"}`)).toThrow("Oversized speech object");
  });
});
