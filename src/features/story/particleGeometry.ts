export type ParticlePoint = { x: number; y: number; light: number };
export type ParticleGeometry = readonly ParticlePoint[];
export type StoryProgress = { current: number };
export const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Stable scatter, so scrubbing in either direction has no random/reseed jumps. */
export function scatter(index: number, salt = 0) {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function starGeometry(count: number): ParticleGeometry {
  const vertices = Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? 0.41 : 0.18;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return Array.from({ length: count }, (_, i) => {
    const side = i % 10;
    const a = vertices[side]; const b = vertices[(side + 1) % 10];
    const edge = scatter(i, 1);
    // Half the particles reinforce the boundary; the rest fill the five arms.
    const radius = Math.floor(i / 10) % 2 === 0 ? 0.97 + scatter(i, 2) * 0.03 : Math.sqrt(scatter(i, 2));
    return { x: (a.x + (b.x - a.x) * edge) * radius, y: (a.y + (b.y - a.y) * edge) * radius, light: 0.6 + scatter(i, 3) * 0.4 };
  });
}

/** Sampling is preparation-only, never called by the renderer or on scroll. */
export function samplePixels(data: Uint8ClampedArray, width: number, height: number, extentX: number, extentY: number, minLight = 0.085): ParticleGeometry {
  const points: ParticlePoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const light = (data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722) / 255;
    if (data[offset + 3] < 128 || light < minLight) continue;
    points.push({ x: (x / (width - 1) - 0.5) * extentX, y: (y / (height - 1) - 0.5) * extentY, light });
  }
  // Deterministic shuffle avoids scanning rows during transitions and preserves
  // full-image coverage when a mobile renderer consumes fewer points.
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(scatter(i, 7) * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  return points;
}

export function particlePhase(progress: number) {
  const bounded = clamp(progress, 0, 5);
  const scene = Math.min(4, Math.floor(bounded));
  return {
    scene, next: Math.min(4, scene + 1),
    morph: scene < 4 ? smooth((bounded - scene - 0.55) / 0.45) : 0,
    reveal: smooth((bounded - 4.42) / 0.48),
  };
}

export function vortexPoint(from: ParticlePoint, to: ParticlePoint, morph: number, index: number, turns: number, seed?: { angle: number; radius: number }): ParticlePoint {
  const pulse = Math.sin(Math.PI * morph);
  const angle = (seed?.angle ?? scatter(index, 4) * Math.PI * 2) + morph * Math.PI * 2 * turns;
  const radius = pulse * (seed?.radius ?? (0.12 + scatter(index, 5) * 0.3));
  return {
    x: from.x + (to.x - from.x) * morph + Math.cos(angle) * radius,
    y: from.y + (to.y - from.y) * morph + Math.sin(angle) * radius * 0.7,
    light: from.light + (to.light - from.light) * morph,
  };
}
