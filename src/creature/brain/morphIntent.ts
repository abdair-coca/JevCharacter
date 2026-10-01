import type { MorphForm } from "./brain.types";

export const MORPH_FORMS: readonly MorphForm[] = ["star", "square", "triangle"];

export function mentionedMorphForms(message: string): MorphForm[] {
  const normalized = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<MorphForm, RegExp> = {
    star: /\b(star|estrella)\b/,
    square: /\b(square|cuadrado)\b/,
    triangle: /\b(triangle|triangulo)\b/,
  };
  return MORPH_FORMS.filter((form) => aliases[form].test(normalized));
}

// Alternatives and negations require Jev's interpretation, not a keyword override.
export function requestedMorphForm(message: string): MorphForm | undefined {
  const named = mentionedMorphForms(message);
  if (/\b(no|not|never|except|menos|excepto|sin)\b|n't\b/i.test(message)) return undefined;
  return named.length === 1 ? named[0] : undefined;
}
