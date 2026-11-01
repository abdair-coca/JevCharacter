import { describe, expect, it } from "vitest";

import { matchWakeWord } from "../src/creature/listen/wakeWord";

describe("matchWakeWord", () => {
  it.each([
    ["Jev, ¿qué carreras puedo estudiar?", "¿qué carreras puedo estudiar?"],
    ["¿Jev, qué carreras puedo estudiar?", "¿qué carreras puedo estudiar?"],
    ["Oye Jev, ¿qué hora es?", "Oye, ¿qué hora es?"],
    ["¿Qué opinas, Jev?", "¿Qué opinas?"],
    ["Hola Jev", "Hola"],
    ["Hey Jeff, what can I study?", "Hey, what can I study?"],
    ["yev cuéntame un chiste", "cuéntame un chiste"],
  ])("finds the name in «%s»", (transcript, message) => {
    expect(matchWakeWord(transcript)).toEqual({ addressed: true, message });
  });

  it.each(["Jev.", "Oye, Jev", "Hey Jev!", "Jev, Jev"])("treats «%s» as only calling him", (transcript) => {
    expect(matchWakeWord(transcript)).toEqual({ addressed: true, message: "" });
  });

  it.each(["¿Qué carreras puedo estudiar?", "Mi primo Jevgeni llega hoy", "Leí sobre jevitas", "Gracias por ver el video."])("ignores «%s»", (transcript) => {
    expect(matchWakeWord(transcript).addressed).toBe(false);
  });
});
