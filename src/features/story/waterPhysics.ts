import { scatter } from "./particleGeometry";
import type { StoryPulse } from "./storyMusic";

export const DROPLETS = 5;
export const RIPPLES = 6;

/** A damped spring in seconds: natural frequency (Hz) and damping ratio. */
type Spring = { hz: number; damping: number };
// Water rings: the body's shape modes are underdamped, so a hit jiggles for a moment.
const PULSE: Spring = { hz: 2.8, damping: 0.25 };
const SQUASH: Spring = { hz: 2.2, damping: 0.12 };
const RIPPLE_MODE: Spring = { hz: 3.4, damping: 0.14 };
// A thrown droplet flies out, slows, falls back and merges.
const FLIGHT: Spring = { hz: 0.9, damping: 0.35 };
const RIPPLE_LIFE = 2.5;

function spring(x: number, v: number, dt: number, { hz, damping }: Spring) {
  const omega = 2 * Math.PI * hz;
  const a = -omega * omega * x - 2 * damping * omega * v;
  const next = v + a * dt;
  return [x + next * dt, next] as const;
}

type Droplet = { active: boolean; angle: number; distance: number; velocity: number; radius: number };
type Ripple = { x: number; y: number; age: number; strength: number };

/**
 * The drop's surface tension, driven by the music. Lengths are in units of the drop's
 * radius, so the same physics serves the small lens and the stage-covering drop.
 * A note ripples the surface, a melody note throws a droplet that falls back and
 * merges, a beat pulses the body and an impact splashes every droplet out.
 */
export function createWater() {
  let pulse = 0; let pulseV = 0;
  const squash = [0, 0]; const squashV = [0, 0];
  const lobes = [0, 0]; const lobesV = [0, 0];
  const droplets: Droplet[] = Array.from({ length: DROPLETS }, (_, i) => ({ active: false, angle: 0, distance: 0, velocity: 0, radius: 0.16 + scatter(i, 3) * 0.08 }));
  const ripples: Ripple[] = [];
  let thrown = 0; let rippled = 0;

  const throwDroplet = (droplet: Droplet, angle: number, speed: number) => {
    droplet.active = true; droplet.angle = angle; droplet.distance = Math.max(droplet.distance, 0.05); droplet.velocity = speed;
  };
  /** Pushes a shape mode toward the given angle: n lobes, oriented by n·angle. */
  const excite = (velocities: number[], harmonic: number, angle: number, amount: number) => {
    velocities[0] += Math.cos(harmonic * angle) * amount; velocities[1] += Math.sin(harmonic * angle) * amount;
  };

  return {
    hit({ kind, strength }: Pick<StoryPulse, "kind" | "strength">) {
      if (kind === "note") {
        const seed = rippled++;
        const radius = Math.sqrt(scatter(seed, 11)) * 0.55; const angle = scatter(seed, 12) * Math.PI * 2;
        if (ripples.length === RIPPLES) ripples.shift();
        ripples.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, age: 0, strength });
      } else if (kind === "melody") {
        const angle = thrown++ * 2.399963 + 0.4;
        const droplet = droplets.find(value => !value.active) ?? droplets[thrown % DROPLETS];
        throwDroplet(droplet, angle, 5 + 4 * strength);
        excite(lobesV, 3, angle, 0.6 * strength);
      } else if (kind === "kick") {
        pulseV += 0.5 * strength;
      } else {
        // A splash: every droplet leaves at once, spread around, and the body sloshes.
        const turn = scatter(thrown++, 13) * Math.PI * 2;
        droplets.forEach((droplet, i) => throwDroplet(droplet, turn + i * Math.PI * 2 / DROPLETS + scatter(i, 14) * 0.5, 7 + 2 * Math.min(strength, 1)));
        excite(squashV, 2, turn, 1.1 * Math.min(strength, 1.3));
        pulseV += 0.6 * strength;
      }
    },
    step(seconds: number) {
      const dt = Math.min(seconds, 1 / 30);
      [pulse, pulseV] = spring(pulse, pulseV, dt, PULSE);
      for (let i = 0; i < 2; i++) {
        [squash[i], squashV[i]] = spring(squash[i], squashV[i], dt, SQUASH);
        [lobes[i], lobesV[i]] = spring(lobes[i], lobesV[i], dt, RIPPLE_MODE);
      }
      for (const droplet of droplets) {
        if (!droplet.active) continue;
        [droplet.distance, droplet.velocity] = spring(droplet.distance, droplet.velocity, dt, FLIGHT);
        // Back inside the body on its way in: it has merged.
        if (droplet.distance <= 0.02 && droplet.velocity < 0) { droplet.active = false; droplet.distance = 0; droplet.velocity = 0; }
      }
      for (const ripple of ripples) ripple.age += dt;
      while (ripples.length && ripples[0].age > RIPPLE_LIFE) ripples.shift();
    },
    /** How far the surface is from rest, for tests and diagnostics. */
    energy() {
      return Math.abs(pulse) + Math.hypot(...squash) + Math.hypot(...lobes) + droplets.reduce((sum, droplet) => sum + (droplet.active ? droplet.distance : 0), 0);
    },
    /**
     * Writes the shader's view: `modes` = [pulse, squash cos/sin 2θ, lobes cos/sin 3θ];
     * droplets as x, y, r around the given center (inactive ones far away); ripples as
     * x, y (absolute), age, strength.
     */
    write(x: number, y: number, radius: number, modes: Float32Array, drops: Float32Array, waves: Float32Array) {
      modes[0] = pulse; modes[1] = squash[0]; modes[2] = squash[1]; modes[3] = lobes[0]; modes[4] = lobes[1];
      droplets.forEach((droplet, i) => {
        const reach = radius * (0.5 + droplet.distance);
        drops[i * 3] = droplet.active ? x + Math.cos(droplet.angle) * reach : 99;
        drops[i * 3 + 1] = droplet.active ? y + Math.sin(droplet.angle) * reach : 99;
        drops[i * 3 + 2] = droplet.active ? droplet.radius * radius : 0;
      });
      for (let i = 0; i < RIPPLES; i++) {
        const ripple = ripples[i];
        waves[i * 4] = ripple ? x + ripple.x * radius : 0; waves[i * 4 + 1] = ripple ? y + ripple.y * radius : 0;
        waves[i * 4 + 2] = ripple ? ripple.age : 0; waves[i * 4 + 3] = ripple ? ripple.strength : 0;
      }
    },
    reset() {
      pulse = 0; pulseV = 0; squash.fill(0); squashV.fill(0); lobes.fill(0); lobesV.fill(0);
      droplets.forEach(droplet => { droplet.active = false; droplet.distance = 0; droplet.velocity = 0; });
      ripples.length = 0;
    },
  };
}

export type Water = ReturnType<typeof createWater>;
