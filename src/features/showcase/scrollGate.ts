// Rules for the Features gate: the scroll may reach the start of "Percibe" and no further until Jev is revealed. The stop is rigid, with no rebound.

/** Keys that scroll the page downwards. */
const DOWN_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);

export function keyScrollsDown(key: string) {
  return DOWN_KEYS.has(key);
}

/** A downward gesture is blocked once the viewport sits on the limit (with one pixel of tolerance). */
export function isGatedDownwards(scrollY: number, limit: number) {
  return scrollY >= limit - 1;
}

/** Scroll positions past the limit are pulled back to it, for jumps and anchors that bypass gestures. */
export function clampToLimit(scrollY: number, limit: number) {
  return scrollY > limit ? limit : null;
}
