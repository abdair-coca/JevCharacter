import { createRigSampler } from "../../phase2/web/rig.mjs";

/** Playback owns time/ordering; real Rive clips own all pose interpolation.
 * now returns milliseconds. subscribe receives an internal tick callback and
 * returns a cleanup function; callers only need the six command methods.
 */
export function createController({ runtime, artboard, contract, catalog, now = () => performance.now(), subscribe = () => () => {}, onChange = () => {} }) {
  const sampler = createRigSampler(runtime, artboard, contract);
  const clips = new Map();
  let disposed = false, order = null, ambient = {}, gaze = {}, release;
  let lastTime = now();
  if (!Number.isFinite(lastTime)) { sampler.dispose(); throw new Error("Clock must return finite milliseconds"); }
  const neutral = { ...contract.neutral };
  function report(event) { onChange(event); }
  try {
    for (const action of Object.values(catalog.actions)) {
      for (const variant of Object.values(action.variants)) {
        if (clips.has(variant.clip)) continue;
        const animation = artboard.animationByName(variant.clip);
        if (!animation) throw new Error(`Clip absent: ${variant.clip}`);
        clips.set(variant.clip, new runtime.LinearAnimationInstance(animation, artboard));
      }
    }
  } catch (error) {
    for (const clip of clips.values()) clip.delete();
    sampler.dispose();
    throw error;
  }
  function alive() { if (disposed) throw new Error("Controller disposed"); }
  function time() {
    const value = now();
    if (!Number.isFinite(value) || value < lastTime) throw new Error("Clock must be finite and monotonic");
    lastTime = value;
    return value;
  }
  function numeric(value, low, high, key) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) throw new Error(`${key}: expected finite number in [${low}, ${high}]`);
    return value;
  }
  function object(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
    for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown field: ${key}`);
  }
  function prepare(id, options = {}) {
    if (typeof id !== "string" || !Object.hasOwn(catalog.actions, id)) throw new Error(`Unknown action: ${id}`);
    object(options, ["intensity", "speed", "variant"]);
    const action = catalog.actions[id], variant = Object.hasOwn(options, "variant") ? options.variant : "default";
    if (typeof variant !== "string" || !Object.hasOwn(action.variants, variant)) throw new Error(`Unknown variant: ${variant}`);
    const intensity = numeric(Object.hasOwn(options, "intensity") ? options.intensity : 1, 0, 1, "intensity");
    const speed = numeric(Object.hasOwn(options, "speed") ? options.speed : 1, .1, 4, "speed");
    return { id, variant, intensity, speed, action, clip: clips.get(action.variants[variant].clip), duration: action.durationMs / speed };
  }
  function settle(target, status, reason) {
    if (target.done) return;
    target.done = true;
    const result = { status, reason, completedItems: target.index, totalItems: target.items.length };
    target.resolve(result);
    report({ type: "finished", ...result });
  }
  function cancel(target, reason) {
    if (!target || target.done) return;
    if (order === target) order = null;
    settle(target, "cancelled", reason);
  }
  function render() {
    const state = { ...neutral, ...ambient, ...gaze };
    const item = order?.items[order.index];
    if (item) for (const channel of item.action.channels) state[channel] = neutral[channel];
    sampler.sample(state);
    if (item) {
      item.clip.time = Math.min(item.action.durationMs, Math.max(0, lastTime - order.started) * item.speed) / 1000;
      item.clip.advance(0);
      item.clip.apply(item.intensity);
      artboard.advance(0);
    }
    report({ type: "frame", action: item?.id ?? null, variant: item?.variant ?? null,
      item: order ? order.index : null, elapsedMs: item ? (lastTime - order.started) * item.speed : 0,
      baseline: state, ownedChannels: item?.action.channels ?? [], neutral: !item && Object.keys(neutral).every(key => state[key] === neutral[key]) });
  }
  function update() {
    if (disposed) return;
    const current = time();
    while (order) {
      const item = order.items[order.index];
      if (current - order.started + 1e-7 < item.duration) break;
      order.started += item.duration;
      order.index += 1;
      report({ type: "itemCompleted", action: item.id, index: order.index - 1 });
      if (order.index === order.items.length) {
        const complete = order;
        order = null;
        settle(complete, "completed", "completed");
      }
    }
    render();
  }
  function start(items) {
    const current = time();
    cancel(order, "replaced");
    // A defined neutral bridge prevents a previous shape from being mixed
    // with the next target. Later continuity work can refine this bridge.
    sampler.neutral();
    let resolve;
    const finished = new Promise(done => { resolve = done; });
    const target = { items, index: 0, started: current, resolve, done: false };
    order = target;
    render();
    return Object.freeze({ finished, cancel() {
      if (disposed || target.done || order !== target) return;
      time(); cancel(target, "handle"); render();
    } });
  }
  const controller = {
    play(id, options = {}) { alive(); return start([prepare(id, options)]); },
    sequence(items) {
      alive();
      if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new Error("Sequence requires 1–100 items");
      const prepared = items.map(item => {
        if (typeof item === "string") return prepare(item);
        object(item, ["action", "intensity", "speed", "variant"]);
        const { action, ...options } = item;
        return prepare(action, options);
      });
      return start(prepared);
    },
    lookAt(x, y) {
      alive();
      numeric(x, ...contract.ranges.gazeX, "gazeX"); numeric(y, ...contract.ranges.gazeY, "gazeY");
      time(); gaze = { gazeX: x, gazeY: y }; update();
    },
    setAmbient(values) {
      alive();
      object(values, Object.keys(contract.ranges));
      for (const [key, value] of Object.entries(values)) numeric(value, ...contract.ranges[key], key);
      time(); ambient = { ...values }; update();
    },
    stop() {
      alive(); time(); cancel(order, "stopped"); ambient = {}; gaze = {};
      sampler.neutral(); render();
    },
    dispose() {
      if (disposed) return;
      cancel(order, "disposed"); ambient = {}; gaze = {}; sampler.neutral();
      disposed = true; release?.();
      for (const clip of clips.values()) clip.delete();
      clips.clear(); sampler.dispose();
      report({ type: "disposed" });
    },
  };
  try { release = subscribe(update); render(); } catch (error) { controller.dispose(); throw error; }
  return Object.freeze(controller);
}
