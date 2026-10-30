import { scatter, type particlePhase } from "./particleGeometry";

type Phase = ReturnType<typeof particlePhase>;
/** Five metaballs shape the body; the rest are droplets merged inside it until they fly out. */
export const LIQUID_BODY = 5;
export const LIQUID_BALLS = 12;
// Σ r² sets the merged radius (~0.38): body 5 × 0.155², droplets 7 × 0.059².
const BODY_RADIUS = 0.155; const DROP_RADIUS = 0.059;
const RING_RADIUS = 0.41; const RING_DROP = 0.058;

/**
 * Writes `x, y, r` per ball (size units, centered, y down) for the shader. Deterministic
 * in phase and time, so scrubbing in either direction never accumulates state.
 */
export function liquidBalls(phase: Phase, time: number, turns: number, out = new Float32Array(LIQUID_BALLS * 3)) {
  const pulse = Math.sin(phase.morph * Math.PI);
  const swirl = phase.morph * Math.PI * 2 * turns;
  for (let i = 0; i < LIQUID_BALLS; i++) {
    let angle: number; let distance: number; let radius: number;
    if (i < LIQUID_BODY) {
      // The body lobes breathe slowly and spread apart while the scene changes.
      angle = i * Math.PI * 2 / LIQUID_BODY + 0.3 + time * 0.12 + swirl * 0.25;
      distance = 0.075 + 0.02 * Math.sin(time * 0.9 * (0.7 + i * 0.13) + i * 2.1) + pulse * 0.17;
      radius = BODY_RADIUS;
    } else {
      const j = i - LIQUID_BODY; const seed = scatter(j, 5);
      angle = scatter(j, 4) * Math.PI * 2 + time * 0.25 * (0.5 + seed) + swirl;
      // At rest a droplet sometimes pushes a lobe out of the surface and sinks back.
      const bud = Math.pow(Math.max(0, Math.sin(time * 0.35 + j * 2.4)), 8) * 0.26;
      distance = 0.09 + bud + pulse * (0.22 + seed * 0.2);
      radius = DROP_RADIUS;
    }
    // Opening Jev: every ball becomes an orbiting droplet and the center empties.
    const ringAngle = i * Math.PI * 2 / LIQUID_BALLS + time * 0.15;
    const ringDistance = RING_RADIUS + 0.025 * Math.sin(time * 0.8 + i * 1.3);
    const x = Math.cos(angle) * distance; const y = Math.sin(angle) * distance;
    out[i * 3] = x + (Math.cos(ringAngle) * ringDistance - x) * phase.reveal;
    out[i * 3 + 1] = y + (Math.sin(ringAngle) * ringDistance - y) * phase.reveal;
    out[i * 3 + 2] = radius + (RING_DROP - radius) * phase.reveal;
  }
  return out;
}
