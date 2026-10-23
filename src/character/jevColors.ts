// Fixed palette for Jev's body. Values feed the Rive `colorBody` property as ARGB; the
// `--jev-skin-*` tokens in tokens.css paint the matching swatches (tests/jevColors.test.ts).
export const JEV_COLORS = {
  violet: 0xffd044ff,
  cyan: 0xff00c8ff,
  pink: 0xffff3d9a,
  orange: 0xffff8a00,
  green: 0xff2ee06f,
  red: 0xffff3b3b,
} as const;

export type JevColor = keyof typeof JEV_COLORS;

export const JEV_COLOR_IDS = Object.keys(JEV_COLORS) as JevColor[];
export const DEFAULT_JEV_COLOR: JevColor = "violet";

export function isJevColor(value: unknown): value is JevColor {
  return typeof value === "string" && Object.hasOwn(JEV_COLORS, value);
}
