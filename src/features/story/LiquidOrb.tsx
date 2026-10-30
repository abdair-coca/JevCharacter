import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { clamp, particlePhase, type StoryProgress } from "./particleGeometry";
import { loadImage } from "./particleAssets";
import { orbState } from "./orbGeometry";
import { ORB_FRAGMENT, ORB_VERTEX } from "./orbShader";

type Props = { progress: StoryProgress; active: boolean; reduced: boolean; onError: () => void };
type Config = {
  texture: number; dpr: number; speed: number; imageScale: number; lens: number; dispersion: number;
  spring: number; damping: number; stretch: number; lensGlow: number; colors: number[][];
};
// Scene images in story order; the first and last scenes are the orb alone.
const IMAGES = ["/story/bob.jpeg", "/story/curiousTiti.webp", "/story/housingML.svg"];
const COLORS = ["base", "pink", "blue", "cyan", "violet"] as const;
const UNIFORMS = ["resolution", "extent", "orb", "stretch", "ring", "time", "surge", "mix", "has", "glow", "imageScale", "lens", "dispersion", "imageA", "imageB", ...COLORS] as const;

function rgb(value: string) {
  const hex = value.trim().replace("#", "");
  return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function readConfig(host: HTMLElement): Config {
  const css = getComputedStyle(host);
  const n = (name: string) => Number.parseFloat(css.getPropertyValue(`--orb-${name}`));
  return {
    texture: n("texture"), dpr: n("dpr"), speed: n("speed"), imageScale: n("image-scale"), lens: n("lens"), dispersion: n("dispersion"),
    spring: n("spring"), damping: n("damping"), stretch: n("stretch"), lensGlow: n("lens-glow"),
    colors: COLORS.map(name => rgb(css.getPropertyValue(`--orb-${name}`))),
  };
}

/** Draws the image contained in a transparent square, in its own colors. */
async function imageCanvas(src: string, size: number, signal: AbortSignal) {
  const image = await loadImage(src, signal);
  const chart = src.endsWith(".svg");
  // The supplied SVG has a percentage size, so a source crop of it draws only its
  // background: rasterize it whole first.
  const raster = chart ? document.createElement("canvas") : null;
  if (raster) {
    raster.width = Math.round(size / 0.36); raster.height = Math.round(raster.width * image.naturalHeight / image.naturalWidth);
    raster.getContext("2d")?.drawImage(image, 0, 0, raster.width, raster.height);
  }
  const source = raster ?? image;
  const width = raster?.width ?? image.naturalWidth; const height = raster?.height ?? image.naturalHeight;
  // The banner is wide: frame its graph, not its small labels.
  const sx = chart ? width * 0.58 : 0; const sy = chart ? height * 0.117 : 0;
  const sw = chart ? width * 0.36 : width; const sh = chart ? height * 0.767 : height;
  const scale = size / Math.max(sw, sh);
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image preparation unavailable");
  context.drawImage(source, sx, sy, sw, sh, (size - sw * scale) / 2, (size - sh * scale) / 2, sw * scale, sh * scale);
  if (raster) { raster.width = 0; raster.height = 0; }
  return canvas;
}

/** Compiles the orb program, or returns null when WebGL2 or the shader is unavailable. */
function setup(element: HTMLCanvasElement) {
  try {
    const gl = element.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl || gl.isContextLost()) return null;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
      return shader;
    };
    const shaders = [compile(gl.VERTEX_SHADER, ORB_VERTEX), compile(gl.FRAGMENT_SHADER, ORB_FRAGMENT)];
    const program = gl.createProgram()!;
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Program failed");
    gl.useProgram(program);
    const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, `u_${name}`)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
    return { gl, program, shaders, uniforms };
  } catch {
    return null;
  }
}

/** A WebGL2 shader owns the glass orb; GSAP's existing ticker supplies the only clock. */
export function LiquidOrb({ progress, active, reduced, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const activity = useRef({ active, reduced });
  const error = useRef(onError);
  const render = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { activity.current = { active, reduced }; error.current = onError; render.current?.(); }, [active, reduced, onError]);
  useEffect(() => {
    const element = canvas.current!;
    const host = element.parentElement!;
    const orb = setup(element);
    // Text and original static resources remain available.
    if (!orb) { error.current(); return; }
    const { gl, program, shaders, uniforms } = orb;
    const config = readConfig(host);
    const abort = new AbortController();
    let disposed = false; let ticking = false; let time = 0; let size = 0; let frameStep = 1;
    let pointer: { x: number; y: number } | null = null;
    // The pointer pulls the orb on a spring; its velocity squashes the orb like a drop.
    let offsetX = 0; let offsetY = 0; let velocityX = 0; let velocityY = 0;
    let textures: (WebGLTexture | null)[] = IMAGES.map(() => null);
    gl.uniform1i(uniforms.imageA, 0); gl.uniform1i(uniforms.imageB, 1);
    COLORS.forEach((name, i) => gl.uniform3fv(uniforms[name], config.colors[i]));
    gl.uniform1f(uniforms.imageScale, config.imageScale); gl.uniform1f(uniforms.lens, config.lens); gl.uniform1f(uniforms.dispersion, config.dispersion);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    const draw = () => {
      if (disposed || !size || gl.isContextLost()) return;
      const moving = !activity.current.reduced;
      const phase = particlePhase(moving ? progress.current : 4.9);
      const state = orbState(phase, time * config.speed);
      const box = pointer && moving ? host.getBoundingClientRect() : null;
      const inside = pointer && box && pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
      if (moving) {
        const targetX = inside && pointer ? ((pointer.x - box.left - box.width / 2) / size - state.x) * state.follow : 0;
        const targetY = inside && pointer ? ((pointer.y - box.top - box.height / 2) / size - state.y) * state.follow : 0;
        const damping = Math.pow(config.damping, frameStep);
        velocityX = (velocityX + (targetX - offsetX) * config.spring * frameStep) * damping;
        velocityY = (velocityY + (targetY - offsetY) * config.spring * frameStep) * damping;
        offsetX += velocityX * frameStep; offsetY += velocityY * frameStep;
      }
      const stretch = Math.min(0.35, Math.hypot(velocityX, velocityY) * config.stretch);
      const direction = Math.atan2(velocityY, velocityX);
      // The first scene has no image; the last one is the orb alone before it opens.
      const has = (scene: number) => (scene >= 1 && scene <= 3 && textures[scene - 1] ? 1 : 0);
      const cover = Math.sin(phase.morph * Math.PI);
      const imageness = has(phase.scene) * (1 - phase.morph) + has(phase.next) * phase.morph;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[phase.scene - 1] ?? null);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[phase.next - 1] ?? null);
      gl.uniform4f(uniforms.orb, state.x + offsetX, state.y + offsetY, state.radius, 1 - phase.reveal * 0.15);
      gl.uniform2f(uniforms.stretch, Math.cos(direction) * stretch, Math.sin(direction) * stretch);
      gl.uniform1f(uniforms.ring, state.ring);
      gl.uniform1f(uniforms.time, time * config.speed); gl.uniform1f(uniforms.surge, moving ? cover : 0);
      // The image swaps while the orb covers the stage.
      gl.uniform1f(uniforms.mix, clamp((phase.morph - 0.42) / 0.16));
      gl.uniform2f(uniforms.has, has(phase.scene), has(phase.next));
      gl.uniform1f(uniforms.glow, Math.max(1 - imageness * (1 - config.lensGlow), cover));
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      element.dataset.phase = String(phase.scene); element.dataset.reveal = phase.reveal.toFixed(3);
      element.dataset.deformation = (moving ? Math.hypot(offsetX, offsetY) + Math.hypot(velocityX, velocityY) : 0).toFixed(4);
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
          gsap.ticker.remove(tick); pointer = null;
          offsetX = 0; offsetY = 0; velocityX = 0; velocityY = 0;
        }
      }
      draw();
    };
    render.current = sync;
    const resize = () => {
      size = host.getBoundingClientRect().width;
      const box = element.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, config.dpr);
      element.width = Math.round(box.width * dpr); element.height = Math.round(box.height * dpr);
      gl.viewport(0, 0, element.width, element.height);
      gl.uniform2f(uniforms.resolution, element.width, element.height);
      gl.uniform2f(uniforms.extent, box.width / (size || 1), box.height / (size || 1));
      draw();
    };
    const move = (event: PointerEvent) => {
      if (!activity.current.active || activity.current.reduced || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      pointer = { x: event.clientX, y: event.clientY };
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) pointer = null; };
    // A lost GPU context falls back to the static reading instead of a blank stage.
    const lost = (event: Event) => { event.preventDefault(); error.current(); };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true }); element.addEventListener("webglcontextlost", lost);
    resize(); sync();
    void Promise.allSettled(IMAGES.map(src => imageCanvas(src, config.texture, abort.signal))).then(results => {
      if (disposed) return;
      textures = results.map(result => {
        if (result.status === "rejected") return null;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Premultiplied on upload, so transparent edges blend without dark fringes.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, result.value);
        result.value.width = 0; result.value.height = 0;
        return texture;
      });
      element.dataset.prepared = "true";
      if (results.some(result => result.status === "rejected")) error.current();
      draw();
    });
    return () => {
      disposed = true; abort.abort(); render.current = null; gsap.ticker.remove(tick);
      observer?.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave); element.removeEventListener("webglcontextlost", lost);
      // The context itself is kept: a remount (Strict Mode) gets the same one back.
      textures.forEach(texture => gl.deleteTexture(texture)); textures = [];
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program);
      element.width = 0; element.height = 0;
    };
  }, [progress]);
  return <canvas className="story-orb" ref={canvas} aria-hidden="true" data-running="false" />;
}
