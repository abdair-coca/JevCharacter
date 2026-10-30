import type { particlePhase } from "./particleGeometry";

type Phase = ReturnType<typeof particlePhase>;
export type OrbState = { x: number; y: number; radius: number; follow: number; ring: number };

// Size units of the flight square (centered, y down). The cover radius reaches the
// image's faded corners, so the image can swap unseen beneath the orb.
const SOLO_RADIUS = 0.3; const LENS_RADIUS = 0.16; const COVER_RADIUS = 0.6; const RING_RADIUS = 0.44;
const hasImage = (scene: number) => scene >= 1 && scene <= 3;

/** Where the orb drifts by itself while a project image is behind it. */
function drift(time: number) {
  return { x: 0.18 * Math.sin(time * 0.23), y: 0.13 * Math.sin(time * 0.31 + 1) };
}

/**
 * The orb is alone and large on the first and last scenes, a small lens over each
 * project image, swells to cover the stage while the scene changes and opens into a
 * ring of light around Jev. Pure in phase and time, so scrubbing never accumulates state.
 */
export function orbState(phase: Phase, time: number): OrbState {
  const hold = (scene: number) => hasImage(scene) ? { ...drift(time), radius: LENS_RADIUS, follow: 1 } : { x: 0, y: 0, radius: SOLO_RADIUS, follow: 0.25 };
  const from = hold(phase.scene); const to = hold(phase.next);
  const cover = Math.sin(phase.morph * Math.PI);
  const mix = (a: number, b: number) => a + (b - a) * phase.morph;
  const centered = 1 - cover;
  return {
    x: mix(from.x, to.x) * centered,
    y: mix(from.y, to.y) * centered,
    radius: mix(from.radius, to.radius) + (COVER_RADIUS - mix(from.radius, to.radius)) * cover + (RING_RADIUS - SOLO_RADIUS) * phase.reveal,
    follow: mix(from.follow, to.follow) * centered * (1 - phase.reveal),
    ring: phase.reveal,
  };
}
