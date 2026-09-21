export function readStorage<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
