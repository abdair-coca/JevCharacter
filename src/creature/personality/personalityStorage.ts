import { readStorage, writeStorage } from "../../lib/storage";
import type { Personality } from "../brain/brain.types";
import { DEFAULT_PERSONALITY } from "./personality";

const STORAGE_KEY = "jevling.personality";

type StoredPersonality = {
  version: 1;
  value: Personality;
};

const inRange = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

function isStoredPersonality(value: unknown): value is StoredPersonality {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredPersonality>;
  const personality = candidate.value;

  return (
    candidate.version === 1 &&
    Boolean(personality) &&
    inRange(personality?.energy) &&
    inRange(personality?.trust) &&
    inRange(personality?.curiosity)
  );
}

export function loadPersonality(): Personality {
  return readStorage<StoredPersonality>(
    STORAGE_KEY,
    { version: 1, value: DEFAULT_PERSONALITY },
    isStoredPersonality,
  ).value;
}

export function savePersonality(value: Personality) {
  writeStorage(STORAGE_KEY, { version: 1, value } satisfies StoredPersonality);
}
