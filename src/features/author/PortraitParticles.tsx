import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { clamp, samplePixels, scatter, smooth, vortexPoint, type ParticleGeometry } from "../story/particleGeometry";
import { glowSprite, loadImage } from "../story/particleAssets";

type Props = { src: string; active: boolean; onError: () => void };
type Config = {
  count: number; mobileCount: number; minCount: number; budget: number; sampleSize: number; minLight: number; extent: number; vignette: number;
  dot: number; glow: number; drift: number; speed: number; spin: number; turns: number; gather: number; stagger: number;
  highlight: number; contrast: number; scan: number; scanPeriod: number; exitSpan: number;
  pointerRadius: number; pointerForce: number; spring: number; damping: number; colors: string[];
};

function readConfig(host: HTMLElement): Config {
  const css = getComputedStyle(host);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(`--portrait-${name}`));
  return {
    count: n("count"), mobileCount: n("mobile-count"), minCount: n("min-count"), budget: n("budget-ms"), sampleSize: n("sample-size"),
    minLight: n("min-light"), extent: n("extent"), vignette: n("vignette"), dot: n("dot"), glow: n("glow"), drift: n("drift"),
    speed: n("speed"), spin: n("spin"), turns: n("turns"), gather: n("gather"), stagger: n("stagger"), highlight: n("highlight"),
    contrast: n("contrast"), scan: n("scan"), scanPeriod: n("scan-period"), exitSpan: n("exit-span"),
    pointerRadius: n("pointer-radius"), pointerForce: n("pointer-force"), spring: n("spring"), damping: n("damping"),
    colors: ["violet", "pink", "white"].map(name => css.getPropertyValue(`--particle-${name}`).trim()),
  };
}

/**
 * Samples the photo once: its square edge fades into a round vignette, the dark background drops out
 * below `minLight`, and the remaining light is stretched over the range so the face reads with contrast.
 */
async function portraitGeometry(src: string, config: Config, signal: AbortSignal): Promise<ParticleGeometry> {
  const image = await loadImage(src, signal);
  const size = config.sampleSize;
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image sampling unavailable");
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fade = 1 - smooth((Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) - config.vignette) / (0.5 - config.vignette));
    const offset = (y * size + x) * 4;
    data[offset] *= fade; data[offset + 1] *= fade; data[offset + 2] *= fade;
  }
  const points = samplePixels(data, size, size, config.extent, config.extent, config.minLight);
  if (points.length < 20) throw new Error("Portrait has no visible particle geometry");
  // A few reflections on the glasses would set the top; the 97th percentile lets the skin reach full light.
  const top = points.map(point => point.light).sort((a, b) => a - b)[Math.floor(points.length * 0.97)];
  return points.map(point => ({ x: point.x, y: point.y, light: clamp((point.light - config.minLight) / Math.max(0.01, top - config.minLight)) }));
}

/**
 * Abdair's photo as a hologram of particles. They turn as a galaxy, gather into the portrait, ripple
 * away from the cursor or a finger and spring back, and dissolve outward as the hero scrolls away.
 * Canvas owns the drawing; GSAP's ticker is the only clock, and it runs only while `active`.
 */
export function PortraitParticles({ src, active, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activity = useRef(active);
  const error = useRef(onError);
  const render = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { activity.current = active; error.current = onError; render.current?.(); }, [active, onError]);
  useEffect(() => {
    const element = canvas.current!;
    const host = element.parentElement!;
    let context: CanvasRenderingContext2D | null = null;
    try { context = element.getContext("2d"); } catch { /* The page shows the photo instead. */ }
    if (!context) { error.current(); return; }
    const ctx = context;
    const config = readConfig(host);
    const abort = new AbortController();
    let disposed = false; let ticking = false; let time = 0; let gathering = 0; let frameStep = 1;
    let width = 0; let height = 0; let bleedX = 0; let bleedY = 0; let canvasWidth = 0; let canvasHeight = 0; let headerBottom = 0;
    let count = config.count; let geometry: ParticleGeometry = [];
    let pointer: { x: number; y: number } | null = null;
    const glows = config.colors.map(glowSprite);
    const seeds = Array.from({ length: config.count }, (_, i) => ({ depth: scatter(i, 8), angle: scatter(i, 4) * Math.PI * 2, radius: 0.08 + scatter(i, 5) * 0.22, delay: scatter(i, 6) }));
    // Before the photo arrives the particles turn as a three-armed galaxy.
    const galaxy = seeds.map((_, i) => {
      const radius = 0.06 + Math.sqrt(scatter(i, 1)) * 0.46;
      const angle = radius * Math.PI * 7 + i % 3 * Math.PI * 2 / 3 + scatter(i) * 0.35;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.72, light: 0.2 + scatter(i, 3) * 0.5 };
    });
    const offsetX = new Float32Array(config.count); const offsetY = new Float32Array(config.count);
    const velocityX = new Float32Array(config.count); const velocityY = new Float32Array(config.count);
    const currentX = new Float32Array(config.count); const currentY = new Float32Array(config.count); const dots = new Float32Array(config.count);
    const buckets = Array.from({ length: 24 }, () => [] as number[]);
    let frames = 0; let drawTime = 0;

    const draw = () => {
      if (disposed || !width || !height) return;
      const started = performance.now();
      const size = Math.min(width, height);
      const box = host.getBoundingClientRect();
      // The hero scrolling under the header dissolves the portrait; scrolling back gathers it again.
      const exit = smooth((headerBottom - box.top) / (box.height * config.exitSpan));
      const inside = pointer !== null && pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
      const cursorX = inside && pointer ? (pointer.x - box.left - width / 2) / size : 0;
      const cursorY = inside && pointer ? (pointer.y - box.top - height / 2) / size : 0;
      const damping = Math.pow(config.damping, frameStep);
      const scanY = (time % config.scanPeriod) / config.scanPeriod * 1.4 - 0.7;
      const ready = geometry.length > 0;
      let deformation = 0; let gathered = ready;
      ctx.clearRect(-bleedX, -bleedY, canvasWidth, canvasHeight);
      ctx.globalCompositeOperation = "lighter";
      for (const bucket of buckets) bucket.length = 0;
      for (let i = 0; i < count; i++) {
        const seed = seeds[i]; const depth = seed.depth;
        const spin = time * config.spin * (0.4 + depth * 0.6);
        const from = galaxy[i];
        const start = { x: from.x * Math.cos(spin) - from.y * Math.sin(spin), y: from.x * Math.sin(spin) + from.y * Math.cos(spin), light: from.light };
        const local = ready ? smooth((gathering - seed.delay * config.stagger) / config.gather) : 0;
        if (local < 1) gathered = false;
        const point = vortexPoint(start, ready ? geometry[i % geometry.length] : start, local, i, config.turns, seed);
        const angle = seed.angle + time * config.speed;
        let x = point.x + Math.sin(angle) * config.drift * (0.3 + depth);
        let y = point.y + Math.cos(angle * 0.8) * config.drift * (0.3 + depth);
        if (exit > 0) {
          const away = Math.atan2(point.y, point.x) + (seed.angle - Math.PI) * 0.12;
          const reach = exit * (0.2 + depth * 0.6);
          x += Math.cos(away) * reach; y += Math.sin(away) * reach - exit * depth * 0.2;
        }
        const dx = x + offsetX[i] - cursorX; const dy = y + offsetY[i] - cursorY;
        const distance = Math.hypot(dx, dy);
        const influence = inside ? Math.max(0, 1 - distance / config.pointerRadius) ** 2 : 0;
        const force = influence * config.pointerForce / Math.max(distance, 0.012);
        velocityX[i] = (velocityX[i] + ((dx - dy * 0.5) * force - offsetX[i]) * config.spring * frameStep) * damping;
        velocityY[i] = (velocityY[i] + ((dy + dx * 0.5) * force - offsetY[i]) * config.spring * frameStep) * damping;
        offsetX[i] += velocityX[i] * frameStep; offsetY[i] += velocityY[i] * frameStep;
        x += offsetX[i]; y += offsetY[i];
        deformation = Math.max(deformation, Math.abs(offsetX[i]) + Math.abs(offsetY[i]));
        // A soft line of light sweeps down the gathered face now and then.
        const scan = config.scan * local * Math.exp(-(((point.y - scanY) / 0.035) ** 2));
        const alpha = clamp((0.14 + point.light ** config.contrast * 0.86 + scan) * (1 - exit * 0.85));
        const color = point.light + scan > config.highlight ? 2 : i % 7 === 0 ? 1 : 0;
        currentX[i] = width / 2 + x * size; currentY[i] = height / 2 + y * size;
        dots[i] = config.dot * (0.6 + depth * 0.55);
        buckets[color * 8 + Math.min(7, Math.floor(alpha * 8))].push(i);
      }
      // Batch cores into 24 paths instead of thousands of per-particle state changes.
      for (let group = 0; group < buckets.length; group++) {
        const bucket = buckets[group]; if (!bucket.length) continue;
        const color = Math.floor(group / 8); const alpha = (group % 8 + 0.5) / 8;
        ctx.globalAlpha = alpha; ctx.fillStyle = config.colors[color]; ctx.beginPath();
        for (const i of bucket) ctx.rect(currentX[i] - dots[i] / 2, currentY[i] - dots[i] / 2, dots[i], dots[i]);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.35;
        for (const i of bucket) if (i % 16 === 0) {
          const glow = dots[i] * config.glow;
          ctx.drawImage(glows[color], currentX[i] - glow / 2, currentY[i] - glow / 2, glow, glow);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      element.dataset.gathered = String(gathered);
      element.dataset.exit = exit.toFixed(3);
      element.dataset.deformation = deformation.toFixed(4);
      drawTime += performance.now() - started;
      if (++frames === 60) {
        // Slower devices keep fewer particles instead of dropping frames.
        if (drawTime / frames > config.budget && count > config.minCount) {
          count = Math.max(config.minCount, Math.floor(count * 0.82)); element.dataset.count = String(count);
        }
        frames = 0; drawTime = 0;
      }
    };
    const tick = (_seconds: number, delta: number) => {
      frameStep = Math.min(delta / (1000 / 60), 2);
      const step = Math.min(delta, 64) / 1000;
      time += step;
      if (geometry.length) gathering += step;
      draw();
    };
    const sync = () => {
      const enabled = activity.current;
      if (enabled !== ticking) {
        ticking = enabled; element.dataset.running = String(enabled);
        if (enabled) gsap.ticker.add(tick);
        else { gsap.ticker.remove(tick); pointer = null; offsetX.fill(0); offsetY.fill(0); velocityX.fill(0); velocityY.fill(0); }
      }
      draw();
    };
    render.current = sync;
    const resize = () => {
      const box = host.getBoundingClientRect(); width = box.width; height = box.height;
      const canvasBox = element.getBoundingClientRect();
      bleedX = box.left - canvasBox.left; bleedY = box.top - canvasBox.top;
      canvasWidth = canvasBox.width; canvasHeight = canvasBox.height;
      headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(canvasWidth * dpr); element.height = Math.round(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, bleedX * dpr, bleedY * dpr);
      count = window.matchMedia("(max-width: 64rem)").matches ? config.mobileCount : config.count;
      element.dataset.count = String(count); draw();
    };
    // A mouse or pen ripples the portrait from anywhere; a finger does it by touching it.
    const move = (event: PointerEvent) => {
      if (!activity.current || (event.pointerType === "touch" && !(event.target instanceof Node && host.contains(event.target)))) return;
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leave = (event: PointerEvent) => { if (event.pointerType === "touch" || !event.relatedTarget) pointer = null; };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host); window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true }); host.addEventListener("pointerdown", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true }); host.addEventListener("pointerup", leave, { passive: true });
    host.addEventListener("pointercancel", leave, { passive: true });
    resize(); sync();
    portraitGeometry(src, config, abort.signal).then(points => {
      if (disposed) return;
      geometry = points; element.dataset.prepared = "true"; draw();
    }, () => { if (!disposed) error.current(); });
    return () => {
      disposed = true; abort.abort(); render.current = null; gsap.ticker.remove(tick);
      observer?.disconnect(); window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move); host.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerout", leave); host.removeEventListener("pointerup", leave);
      host.removeEventListener("pointercancel", leave);
      element.width = 0; element.height = 0; geometry = [];
    };
  }, [src]);
  return <canvas className="author-particles" ref={canvas} aria-hidden="true" data-running="false" />;
}
