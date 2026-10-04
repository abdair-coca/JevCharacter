import { createController } from "/controller.mjs";

const element = id => document.getElementById(id);
const canvas = element("character"), actionSelect = element("action"), variantSelect = element("variant");
const abort = new AbortController();
let runtime, renderer, contract, current, frame = null, pollTimer, disposed = false, loading = false;

async function get(url, json = false) {
  const response = await fetch(url, { cache: "no-store", signal: abort.signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return json ? response.json() : response.arrayBuffer();
}
function variants() {
  const action = current.catalog.actions[actionSelect.value];
  variantSelect.replaceChildren(...Object.keys(action.variants).map(name => new Option(name, name)));
  element("intent").textContent = action.intent;
}
function controls() {
  const previous = actionSelect.value;
  actionSelect.replaceChildren(...Object.keys(current.catalog.actions).map(name => new Option(name, name)));
  if (Object.hasOwn(current.catalog.actions, previous)) actionSelect.value = previous;
  variants();
  for (const node of document.querySelectorAll("button,select")) node.disabled = false;
}
function diagnostics(candidate, event) {
  if (event.type === "frame") candidate.frame = event;
  else { candidate.events.push(event); if (candidate.events.length > 10) candidate.events.shift(); }
}
function release(candidate) {
  candidate?.controller?.dispose(); candidate?.board?.delete(); candidate?.file?.unref();
}
async function load(generation) {
  if (loading || disposed) return;
  loading = true;
  const candidate = { generation, events: [], tick: null };
  try {
    const [catalog, bytes] = await Promise.all([get(`/generation/${generation}/catalog.json`, true), get(`/generation/${generation}/actions.riv`)]);
    if (catalog.generation !== generation) throw new Error("Catalog/RIV generation mismatch");
    candidate.catalog = catalog;
    candidate.file = await runtime.load(new Uint8Array(bytes), undefined, false);
    candidate.board = candidate.file.artboardByName(contract.artboard.name);
    if (!candidate.board) throw new Error("Artboard absent");
    candidate.controller = createController({ runtime, artboard: candidate.board, contract, catalog,
      subscribe(tick) { candidate.tick = tick; return () => { candidate.tick = null; }; },
      onChange: event => diagnostics(candidate, event) });
    if (disposed) { release(candidate); return; }
    const previous = current;
    current = candidate;
    release(previous);
    window.phase3 = { controller: current.controller, catalog, diagnostics: candidate };
    controls(); element("result").textContent = "Nuevo build cargado; neutral completo.";
    element("status").textContent = `Listo · ${Object.keys(catalog.actions).length} acciones · generación ${generation} · Rive 2.42.2`;
    element("errors").textContent = "";
  } catch (error) {
    release(candidate);
    if (!disposed) element("errors").textContent = `Carga falló: ${error.message}. Último preview válido conservado.`;
  } finally { loading = false; }
}
function draw() {
  frame = null;
  if (disposed || document.hidden) return;
  try {
    if (current) {
      current.tick();
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 3);
      const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      renderer.clear(); renderer.save();
      renderer.align(runtime.Fit.contain, runtime.Alignment.center, { minX: 0, minY: 0, maxX: width, maxY: height }, current.board.bounds);
      current.board.draw(renderer); renderer.restore(); renderer.flush(); runtime.resolveAnimationFrame();
      element("playback").textContent = current.frame.action ? `${current.frame.action} · ${current.frame.variant} · ${Math.round(current.frame.elapsedMs)} ms` : current.frame.neutral ? "Neutral completo" : "Pose ambiental estática";
      element("diagnostics").textContent = JSON.stringify({ generation: current.generation, ...current.frame, events: current.events }, null, 2);
      element("diagnostics").dataset.state = current.frame.neutral ? "neutral" : "active";
    }
  } catch (error) { element("errors").textContent = `Reproducción: ${error.message}`; }
  frame = runtime.requestAnimationFrame(draw);
}
async function poll() {
  if (disposed) return;
  try {
    const status = await get(`/status.json?t=${Date.now()}`, true);
    if (status.error) {
      if (!current && status.generation) await load(status.generation);
      element("errors").textContent = `${status.error.file}:${status.error.pointer}\n${status.error.message}\nÚltimo preview válido conservado.`;
      element("status").textContent = `Error localizado · revisión ${status.revision} · generación válida ${status.generation ?? "ninguna"}`;
    } else if (status.generation && status.generation !== current?.generation) await load(status.generation);
    else if (!loading && current) {
      element("errors").textContent = "";
      element("status").textContent = `Listo · ${Object.keys(current.catalog.actions).length} acciones · generación ${current.generation} · Rive 2.42.2`;
    }
  } catch (error) { if (!disposed) element("errors").textContent = `Servidor: ${error.message}`; }
  if (!disposed) pollTimer = setTimeout(poll, 700);
}
function options() { return { variant: variantSelect.value, intensity: Number(element("intensity").value), speed: Number(element("speed").value) }; }
function observe(handle) {
  const owner = current;
  handle.finished.then(result => { if (current === owner && !disposed) element("result").textContent = `${result.status} · ${result.reason} · ${result.completedItems}/${result.totalItems}`; });
}
function command(operation) { try { operation(); } catch (error) { element("result").textContent = error.message; } }
actionSelect.addEventListener("change", variants);
element("play").addEventListener("click", () => command(() => observe(current.controller.play(actionSelect.value, options()))));
element("sequence").addEventListener("click", () => command(() => observe(current.controller.sequence(Object.keys(current.catalog.actions).map(action => ({ action, intensity: options().intensity, speed: options().speed }))))));
element("interrupt").addEventListener("click", () => command(() => observe(current.controller.play("curious_look", { speed: options().speed, intensity: options().intensity }))));
element("stop").addEventListener("click", () => command(() => { current.controller.stop(); element("result").textContent = "Stop: geometría, ojos, cuerpo y luz neutrales."; }));
element("look").addEventListener("click", () => command(() => current.controller.lookAt(-6, 0)));
element("ambient").addEventListener("click", () => command(() => current.controller.setAmbient({ light: .8 })));
function cleanup() {
  if (disposed) return; disposed = true; abort.abort(); clearTimeout(pollTimer);
  if (frame !== null) runtime?.cancelAnimationFrame(frame); frame = null;
  release(current); renderer?.delete(); runtime?.cleanup?.();
}
window.addEventListener("pagehide", cleanup, { once: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { current?.controller.stop(); if (frame !== null) runtime.cancelAnimationFrame(frame); frame = null; }
  else if (!disposed && runtime && frame === null) frame = runtime.requestAnimationFrame(draw);
});
async function start() {
  try {
    contract = await get("/contract.json", true);
    window.rive.RuntimeLoader.setWasmUrl("/rive.wasm"); window.rive.RuntimeLoader.setWasmFallbackUrl(null);
    runtime = await window.rive.RuntimeLoader.awaitInstance();
    if (disposed) return;
    renderer = runtime.makeRenderer(canvas, true);
    frame = runtime.requestAnimationFrame(draw);
    await poll();
  } catch (error) { if (!disposed) element("errors").textContent = `Inicio: ${error.message}`; }
}
start();
