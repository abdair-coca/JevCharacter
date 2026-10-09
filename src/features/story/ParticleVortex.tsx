import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { particlePhase, samplePixels, scatter, starGeometry, vortexPoint, type ParticleGeometry, type StoryProgress } from "./particleGeometry";

type Props = { progress: StoryProgress; active: boolean; reduced: boolean; onError: () => void };
type Config = { count: number; mobileCount: number; orbitCount: number; sampleSize: number; dot: number; glow: number; drift: number; speed: number; parallax: number; turns: number; trail: number; highlight: number; contrast: number; budget: number; minCount: number; pointerRadius: number; pointerForce: number; spring: number; damping: number; current: number; colors: string[] };

function readConfig(host: HTMLElement): Config {
  const css = getComputedStyle(host);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(`--particle-${name}`));
  return {
    count: n("count"), mobileCount: n("mobile-count"), orbitCount: n("orbits"), sampleSize: n("sample-size"),
    dot: n("dot"), glow: n("glow"), drift: n("drift"), speed: n("speed"), parallax: n("parallax"), turns: n("turns"), trail: n("trail"),
    highlight: n("highlight"), contrast: n("contrast"), budget: n("budget-ms"), minCount: n("min-count"),
    pointerRadius: n("pointer-radius"), pointerForce: n("pointer-force"), spring: n("spring"), damping: n("damping"), current: n("current"),
    colors: ["violet", "pink", "white"].map(name => css.getPropertyValue(`--particle-${name}`).trim()),
  };
}

function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timeout); signal.removeEventListener("abort", abort);
      image.onload = null; image.onerror = null;
      if (error) { image.src = ""; reject(error); } else resolve(image);
    };
    const abort = () => finish(new Error("Image preparation cancelled"));
    const timeout = window.setTimeout(() => finish(new Error("Image preparation timed out")), 12000);
    image.onload = () => finish(); image.onerror = () => finish(new Error(`Cannot load ${src}`));
    signal.addEventListener("abort", abort, { once: true });
    image.src = src;
  });
}

async function imageGeometry(src: string, size: number, signal: AbortSignal): Promise<ParticleGeometry> {
  const image = await loadImage(src, signal);
  const chart = src.endsWith(".svg");
  // The supplied SVG is a wide banner: sample its graph, not its small labels.
  const sx = chart ? image.naturalWidth * 0.58 : 0;
  const sy = chart ? image.naturalHeight * 0.117 : 0;
  const sw = chart ? image.naturalWidth * 0.36 : image.naturalWidth;
  const sh = chart ? image.naturalHeight * 0.767 : image.naturalHeight;
  const ratio = sw / sh;
  const width = Math.round(ratio > 1 ? size : size * ratio);
  const height = Math.round(ratio > 1 ? size / ratio : size);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image sampling unavailable");
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const points = samplePixels(context.getImageData(0, 0, width, height).data, width, height, ratio > 1 ? 0.86 : 0.84 * ratio, ratio > 1 ? 0.86 / ratio : 0.84, chart ? 0.14 : 0.085);
  if (points.length < 20) throw new Error("Image has no visible particle geometry");
  return points;
}

function sprite(color: string) {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, color); gradient.addColorStop(0.15, color); gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
  return canvas;
}

/** Canvas owns particle drawing; GSAP's existing ticker supplies the only clock. */
export function ParticleVortex({ progress, active, reduced, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activity = useRef({ active, reduced });
  const error = useRef(onError);
  const render = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { activity.current = { active, reduced }; error.current = onError; render.current?.(); }, [active, reduced, onError]);
  useEffect(() => {
    const element = canvas.current!;
    const host = element.parentElement!;
    let context: CanvasRenderingContext2D | null = null;
    try { context = element.getContext("2d"); } catch { /* Text and original static resources remain available. */ }
    if (!context) { error.current(); return; }
    const ctx = context;
    const config = readConfig(host);
    const abort = new AbortController();
    let disposed = false; let ticking = false; let time = 0; let width = 0; let height = 0;
    let count = config.count; let geometries: ParticleGeometry[] = [];
    let pointerX = 0; let pointerY = 0; let px = 0; let py = 0;
    let pointer: { x: number; y: number } | null = null;
    let frameStep = 1;
    const stars = starGeometry(config.count);
    const opening = stars.map((_, i) => {
      const radius = 0.07 + Math.sqrt(scatter(i, 1)) * 0.4;
      const angle = radius * Math.PI * 8 + i % 3 * Math.PI * 2 / 3 + scatter(i) * 0.35;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.7, light: scatter(i, 3) };
    });
    const glows = config.colors.map(sprite);
    const seeds = stars.map((_, i) => ({ depth: scatter(i, 8), angle: scatter(i, 4) * Math.PI * 2, radius: 0.12 + scatter(i, 5) * 0.3 }));
    const orbits = Array.from({ length: config.orbitCount }, (_, i) => scatter(i, 9));
    const previousX = new Float32Array(config.count); const previousY = new Float32Array(config.count);
    const currentX = new Float32Array(config.count); const currentY = new Float32Array(config.count);
    // Local displacement is independent of the authored shape. Springs return
    // particles to it after the pointer leaves, even during a reversible morph.
    const offsetX = new Float32Array(config.count); const offsetY = new Float32Array(config.count);
    const velocityX = new Float32Array(config.count); const velocityY = new Float32Array(config.count);
    const dots = new Float32Array(config.count);
    const buckets = Array.from({ length: 24 }, () => [] as number[]);
    let previousProgress = -1; let history = false; let frames = 0; let drawTime = 0;
    const draw = () => {
      if (disposed || !width || !height) return;
      const started = performance.now();
      const phase = particlePhase(activity.current.reduced ? 4.9 : progress.current);
      const size = Math.min(width, height);
      const moving = !activity.current.reduced;
      const box = pointer && moving ? host.getBoundingClientRect() : null;
      const pointerInside = pointer && box && pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
      const cursorX = pointerInside && pointer ? (pointer.x - box.left - width / 2) / size : 0;
      const cursorY = pointerInside && pointer ? (pointer.y - box.top - height / 2) / size : 0;
      pointerX = pointerInside ? Math.max(-0.5, Math.min(0.5, cursorX)) : 0;
      pointerY = pointerInside ? Math.max(-0.5, Math.min(0.5, cursorY)) : 0;
      ctx.clearRect(0, 0, width, height);
      px += (pointerX - px) * 0.055; py += (pointerY - py) * 0.055;
      const parallaxX = moving ? px * size * config.parallax : 0;
      const parallaxY = moving ? py * size * config.parallax : 0;
      const current = geometries[phase.scene] ?? (phase.scene === 0 ? opening : stars);
      const next = geometries[phase.next] ?? stars;
      const trail = moving && history && Math.abs(progress.current - previousProgress) < 0.12;
      const surge = Math.sin(phase.morph * Math.PI);
      const damping = Math.pow(config.damping, frameStep);
      let deformation = 0;
      ctx.globalCompositeOperation = "lighter";
      buckets.forEach(bucket => { bucket.length = 0; });
      for (let i = 0; i < count; i++) {
        const from = current[i % current.length]; const to = next[i % next.length];
        const seed = seeds[i];
        const point = vortexPoint(from, to, phase.morph, i, config.turns, seed);
        const depth = seed.depth;
        const angle = seed.angle + time * config.speed;
        const drift = moving ? config.drift * (0.3 + depth) : 0;
        let x = point.x + Math.sin(angle) * drift;
        let y = point.y + Math.cos(angle * 0.8) * drift;
        if (phase.scene === 0 && moving) {
          const turn = time * config.speed * (0.15 + depth * 0.25);
          const ox = x; x = x * Math.cos(turn) - y * Math.sin(turn); y = ox * Math.sin(turn) + y * Math.cos(turn);
        }
        if (phase.reveal > 0) {
          // A clear center opens while the same five arms expand into a halo.
          const radial = Math.atan2(point.y, point.x);
          const radius = 0.32 + depth * 0.14;
          x += (Math.cos(radial + phase.reveal * 0.3) * radius - x) * phase.reveal;
          y += (Math.sin(radial + phase.reveal * 0.3) * radius - y) * phase.reveal;
        }
        if (moving) {
          // Braided currents fan out while scrolling, then resolve into a crisp image.
          x += Math.sin(angle * 2 + point.y * 12) * config.current * surge * depth;
          y += Math.cos(angle * 1.5 + point.x * 12) * config.current * surge * depth;
          const dx = x + offsetX[i] - cursorX;
          const dy = y + offsetY[i] - cursorY;
          const distance = Math.hypot(dx, dy);
          const influence = pointerInside ? Math.max(0, 1 - distance / config.pointerRadius) ** 2 : 0;
          const force = influence * config.pointerForce / Math.max(distance, 0.012);
          const targetX = (dx - dy * 0.65) * force;
          const targetY = (dy + dx * 0.65) * force;
          velocityX[i] = (velocityX[i] + (targetX - offsetX[i]) * config.spring * frameStep) * damping;
          velocityY[i] = (velocityY[i] + (targetY - offsetY[i]) * config.spring * frameStep) * damping;
          offsetX[i] += velocityX[i] * frameStep;
          offsetY[i] += velocityY[i] * frameStep;
          x += offsetX[i]; y += offsetY[i];
          deformation = Math.max(deformation, Math.abs(offsetX[i]) + Math.abs(offsetY[i]));
        }
        x = width / 2 + x * size + parallaxX * depth;
        y = height / 2 + y * size + parallaxY * depth;
        const color = point.light > config.highlight ? 2 : i % 7 === 0 ? 1 : 0;
        const alpha = (0.22 + Math.pow(point.light, config.contrast) * 0.8) * (1 - phase.reveal * 0.68);
        const dot = config.dot * (0.65 + depth * 0.5);
        currentX[i] = x; currentY[i] = y; dots[i] = dot;
        buckets[color * 8 + Math.min(7, Math.floor(alpha * 8))].push(i);
      }
      // Batch cores into 24 paths instead of thousands of per-particle state changes.
      for (let group = 0; group < buckets.length; group++) {
        const bucket = buckets[group]; if (!bucket.length) continue;
        const color = Math.floor(group / 8); const alpha = (group % 8 + 0.5) / 8;
        if (trail && (phase.morph > 0.05 || deformation > 0.002)) {
          ctx.globalAlpha = config.trail * alpha; ctx.strokeStyle = config.colors[color]; ctx.lineWidth = config.dot * 0.55;
          ctx.beginPath();
          for (const i of bucket) if (i % 8 === 0) { ctx.moveTo(previousX[i], previousY[i]); ctx.lineTo(currentX[i], currentY[i]); }
          ctx.stroke();
        }
        ctx.globalAlpha = alpha; ctx.fillStyle = config.colors[color]; ctx.beginPath();
        for (const i of bucket) ctx.rect(currentX[i] - dots[i] / 2, currentY[i] - dots[i] / 2, dots[i], dots[i]);
        ctx.fill();
        ctx.globalAlpha = alpha * (0.3 + surge * 0.2);
        for (const i of bucket) if (i % 16 === 0) {
          const glow = dots[i] * config.glow * (1 + surge);
          ctx.drawImage(glows[color], currentX[i] - glow / 2, currentY[i] - glow / 2, glow, glow);
        }
      }
      // Sparse luminous currents stay outside the recognizable image's core.
      for (let i = 0; i < config.orbitCount; i++) {
        const depth = orbits[i]; const angle = i * 2.399963 + (moving ? time * config.speed * (0.2 + depth * 0.6) : 0);
        const radius = size * (0.33 + depth * 0.14 + surge * 0.03);
        const x = width / 2 + Math.cos(angle) * radius + parallaxX * depth;
        const y = height / 2 + Math.sin(angle) * radius * 0.72 + parallaxY * depth;
        const dot = config.dot * (0.5 + depth);
        if (moving && i % 4 === 0) {
          ctx.strokeStyle = config.colors[i % 2]; ctx.lineWidth = dot * 0.4; ctx.globalAlpha = 0.16;
          ctx.beginPath(); ctx.ellipse(width / 2 + parallaxX * depth, height / 2 + parallaxY * depth, radius, radius * 0.72, 0, angle - 0.05 - surge * 0.22, angle); ctx.stroke();
        }
        ctx.globalAlpha = 0.12 + depth * 0.25;
        ctx.drawImage(glows[i % 2], x - dot * 3, y - dot * 3, dot * 6, dot * 6);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      previousX.set(currentX); previousY.set(currentY);
      previousProgress = progress.current; history = moving;
      element.dataset.phase = String(phase.scene); element.dataset.reveal = phase.reveal.toFixed(3);
      element.dataset.deformation = deformation.toFixed(4);
      drawTime += performance.now() - started;
      if (++frames === 60) {
        const average = drawTime / frames;
        element.dataset.drawMs = average.toFixed(2);
        if (moving && average > config.budget && count > config.minCount) {
          count = Math.max(config.minCount, Math.floor(count * 0.82)); element.dataset.count = String(count);
        }
        frames = 0; drawTime = 0;
      }
    };
    const tick = (_seconds: number, delta: number) => {
      frameStep = Math.min(delta / (1000 / 60), 2);
      time += Math.min(delta, 64) / 1000; draw();
    };
    const sync = () => {
      const enabled = activity.current.active && !activity.current.reduced;
      if (enabled !== ticking) {
        ticking = enabled; element.dataset.running = String(enabled);
        if (enabled) gsap.ticker.add(tick); else {
          gsap.ticker.remove(tick); history = false; pointer = null;
          offsetX.fill(0); offsetY.fill(0); velocityX.fill(0); velocityY.fill(0);
        }
      }
      draw();
    };
    render.current = sync;
    const resize = () => {
      const box = host.getBoundingClientRect(); width = box.width; height = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      count = window.matchMedia("(max-width: 64rem)").matches ? config.mobileCount : config.count;
      element.dataset.count = String(count); history = false; draw();
    };
    const move = (event: PointerEvent) => {
      if (!activity.current.active || activity.current.reduced || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) pointer = null; };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true });
    resize(); sync();
    void Promise.allSettled(["/story/bob.jpeg", "/story/curiousTiti.webp", "/story/housingML.svg"].map(src => imageGeometry(src, config.sampleSize, abort.signal))).then(results => {
      if (disposed) return;
      geometries = [opening, ...results.map(result => result.status === "fulfilled" ? result.value : stars), stars];
      element.dataset.prepared = "true";
      if (results.some(result => result.status === "rejected")) error.current();
      draw();
    });
    return () => {
      disposed = true; abort.abort(); render.current = null; gsap.ticker.remove(tick);
      observer?.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      element.width = 0; element.height = 0; geometries = [];
    };
  }, [progress]);
  return <canvas className="story-particles" ref={canvas} aria-hidden="true" data-running="false" />;
}
