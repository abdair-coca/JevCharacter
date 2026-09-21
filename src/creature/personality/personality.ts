import type { Personality, SensorSnapshot } from "../brain/brain.types";

export const DEFAULT_PERSONALITY: Personality = {
  energy: 70,
  trust: 50,
  curiosity: 80,
};

type PersonalityEvents = {
  clickBurst: boolean;
  returned: boolean;
  contextReceived: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function evolvePersonality(
  current: Personality,
  sensors: SensorSnapshot,
  events: PersonalityEvents,
  elapsedSeconds: number,
): Personality {
  let energy = current.energy;
  let trust = current.trust;
  let curiosity = current.curiosity;

  if (sensors.idleSeconds > 7) energy += 0.11 * elapsedSeconds;

  if (
    sensors.cursorNearCreature &&
    sensors.cursorSpeed > 35 &&
    sensors.cursorSpeed < 900
  ) {
    curiosity += 0.16 * elapsedSeconds;
    trust += 0.025 * elapsedSeconds;
  }

  if (events.clickBurst) {
    energy -= 2.8;
    trust -= 1.1;
    curiosity += 0.7;
  }

  if (events.returned) curiosity += Math.min(3, 1 + sensors.absenceSeconds / 30);

  if (events.contextReceived) {
    trust += 0.8;
    curiosity += 1.5;
  }

  return {
    energy: clamp(energy),
    trust: clamp(trust),
    curiosity: clamp(curiosity),
  };
}
