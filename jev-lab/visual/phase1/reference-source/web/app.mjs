import { validateSettings, neutralPose, pointerTarget, approachPose, settlePose } from "./controller.mjs";
import { ActionLifecycle, applyActionFrame, hitBody, handleActivationKey, suspendAction } from "./action.mjs";

const canvas = document.getElementById("jev");
const status = document.getElementById("status");
const diagnostics = document.getElementById("diagnostics");
const curiosityButton = document.getElementById("curiosity");
const lifecycle = new ActionLifecycle();
const abort = new AbortController();
const properties = ["x", "y", "rotation", "scaleX", "scaleY"];
let runtime, file, artboard, renderer, observer, anatomy, settings, nodes, baseline;
let pose, target, frameId = null, lastTime = null, pointer = null, disposed = false, ready = false;
let frames = 0;
let actionInstance = null, actionSpecs = null;
let cancellationCount = 0;

function message(text) {
  if (status.textContent !== text) status.textContent = text;
}

function capturePose() {
  return Object.fromEntries(Object.entries(nodes).map(([name, node]) => [name, Object.fromEntries(properties.map((property) => [property, node[property]]))]));
}

function restoreBaseline() {
  for (const [name, values] of Object.entries(baseline)) {
    for (const property of properties) nodes[name][property] = values[property];
  }
}

function applyPose() {
  restoreBaseline();
  nodes.eyes.x = pose.eyeX;
  nodes.eyes.y = pose.eyeY;
  nodes.root.rotation = pose.rotation;
}

function diagnose() {
  if (!ready) return;
  const transforms = capturePose();
  const neutral = Object.entries(transforms).every(([name, values]) => properties.every((property) => values[property] === baseline[name][property]));
  diagnostics.dataset.state = disposed ? "disposed" : lifecycle.active ? "action" : lifecycle.neutralFrame ? "neutral-transition" : pointer ? "following" : neutral ? "neutral" : "returning";
  diagnostics.dataset.pose = JSON.stringify(transforms);
  diagnostics.dataset.neutral = String(neutral);
  diagnostics.dataset.framePending = String(frameId !== null);
  diagnostics.dataset.frameCount = String(frames);
  diagnostics.dataset.artboardSize = JSON.stringify({ width: artboard.width, height: artboard.height });
  diagnostics.dataset.activeAnimation = lifecycle.active?.name || "none";
  diagnostics.dataset.actionTime = String(lifecycle.active?.elapsed || 0);
  diagnostics.dataset.acceptedRequests = String(lifecycle.acceptedRequests);
  diagnostics.dataset.ignoredRequests = String(lifecycle.ignoredRequests);
  diagnostics.dataset.stateMachine = "none";
  diagnostics.dataset.visibility = document.hidden ? "hidden" : "visible";
  diagnostics.dataset.cancellationCount = String(cancellationCount);
  diagnostics.textContent = neutral ? "Pose neutral." : "Seguimiento suave activo.";
  curiosityButton.disabled = !ready || disposed || lifecycle.busy;
  canvas.setAttribute("aria-disabled", String(disposed || lifecycle.busy));
}

function wake() {
  if (!ready || disposed || document.hidden || frameId !== null) return;
  lastTime = performance.now();
  frameId = runtime.requestAnimationFrame(draw);
  diagnose();
}

function requestNext() {
  frameId = runtime.requestAnimationFrame(draw);
}

function draw(timestamp) {
  frameId = null;
  if (disposed || document.hidden) return;
  try {
    const seconds = Math.max(0, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    const sample = lifecycle.tick(seconds);
    let settled = false;
    if (sample.owner === "action") {
      actionInstance.advance(seconds);
      applyActionFrame(nodes, baseline, sample.action, sample.mix, actionInstance);
    } else if (sample.owner === "neutral") {
      actionInstance.delete(); actionInstance = null;
      pose = neutralPose(anatomy);
      restoreBaseline();
      message("JEV vuelve a descansar.");
    } else {
      const result = settlePose(approachPose(pose, target, seconds, settings), target, settings);
      pose = result.pose;
      settled = result.settled;
      applyPose();
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    artboard.advance(0);
    renderer.beginFrame();
    renderer.save();
    renderer.align(runtime.Fit.contain, runtime.Alignment.center, { minX: 0, minY: 0, maxX: width, maxY: height }, artboard.bounds);
    artboard.draw(renderer);
    renderer.restore();
    frames += 1;
    if (sample.owner === "neutral") {
      // Evidencia de los nodos entregados al renderer, no solo del lifecycle.
      diagnostics.dataset.lastNeutralPose = JSON.stringify(capturePose());
      diagnostics.dataset.lastCompletedAnimation = sample.completed.name;
      diagnostics.dataset.lastCompletedDuration = String(sample.completed.elapsed);
      diagnostics.dataset.neutralTransitionCount = String(Number(diagnostics.dataset.neutralTransitionCount || 0) + 1);
      diagnostics.dataset.lastNeutralFrame = String(frames);
    }
    if (!settled) requestNext();
    else if (!pointer) message("Listo. Mueve el cursor para saludar.");
    diagnose();
  } catch (error) { fail(error); }
}

function follow(event) {
  if (!ready || disposed || document.hidden) return;
  pointer = { x: event.clientX, y: event.clientY };
  target = pointerTarget(pointer.x, pointer.y, canvas.getBoundingClientRect(), anatomy, settings);
  if (!lifecycle.busy) message("JEV te sigue con calma.");
  wake();
}

function leave() {
  if (!ready || disposed) return;
  pointer = null;
  target = neutralPose(anatomy);
  if (!lifecycle.busy) message("Volviendo a descansar…");
  wake();
}

function resize() {
  if (!ready || disposed) return;
  if (pointer) {
    const rect = canvas.getBoundingClientRect();
    if (pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom) {
      target = pointerTarget(pointer.x, pointer.y, rect, anatomy, settings);
    } else { pointer = null; target = neutralPose(anatomy); }
  }
  wake();
}

function visibility() {
  if (!ready || disposed) return;
  if (document.hidden) {
    if (frameId !== null) runtime.cancelAnimationFrame(frameId);
    frameId = null; pointer = null;
    if (suspendAction(lifecycle, actionInstance, nodes, baseline)) cancellationCount += 1;
    actionInstance = null;
    target = neutralPose(anatomy); pose = { ...target };
    applyPose(); diagnose();
  } else { message("Listo. Mueve el cursor para saludar."); wake(); }
}

function cleanup() {
  if (disposed) return;
  disposed = true;
  abort.abort();
  if (frameId !== null) runtime?.cancelAnimationFrame(frameId);
  frameId = null;
  observer?.disconnect();
  lifecycle.cancel();
  actionInstance?.delete(); actionInstance = null;
  canvas.removeEventListener("pointerenter", follow);
  canvas.removeEventListener("pointermove", follow);
  canvas.removeEventListener("pointerleave", leave);
  canvas.removeEventListener("pointercancel", leave);
  canvas.removeEventListener("click", clickBody);
  canvas.removeEventListener("keydown", characterKey);
  curiosityButton.removeEventListener("click", curiosity);
  curiosityButton.disabled = true;
  canvas.setAttribute("aria-disabled", "true");
  window.removeEventListener("blur", leave);
  window.removeEventListener("resize", resize);
  document.removeEventListener("visibilitychange", visibility);
  diagnostics.dataset.state = "disposed";
  diagnostics.dataset.framePending = "false";
  artboard?.delete(); artboard = null;
  file?.unref(); file = null;
  renderer?.delete(); renderer = null;
  runtime?.cleanup();
}

function fail(error) {
  cleanup();
  diagnostics.dataset.state = "error";
  message(`No se pudo abrir Mini JEV: ${error.message}. Recarga la página o revisa el servidor local.`);
  console.error(error);
}

async function get(path, json = false) {
  const response = await fetch(path, { signal: abort.signal, cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return json ? response.json() : response.arrayBuffer();
}

async function start() {
  try {
    [anatomy, settings] = await Promise.all([get("/rive/character/body_contract.json", true), get("/web/follow.json", true)]);
    validateSettings(settings, anatomy);
    // UMD defer y module se cargan antes de DOMContentLoaded.
    if (!window.rive?.RuntimeLoader) throw new Error("Runtime Rive local no disponible");
    window.rive.RuntimeLoader.setWasmUrl("/output/tools/browser/rive.wasm");
    window.rive.RuntimeLoader.setWasmFallbackUrl(null);
    runtime = await window.rive.RuntimeLoader.awaitInstance();
    if (disposed) { runtime.cleanup(); return; }
    const bytes = await get("/output/build/mini_jev.riv");
    file = await runtime.load(new Uint8Array(bytes), undefined, false);
    if (disposed) { file.unref(); file = null; return; }
    artboard = file.artboardByName(anatomy.artboard.name);
    if (!artboard) throw new Error("Artboard MiniJev ausente");
    nodes = Object.fromEntries(Object.entries({ root: "Jev", bodyTransform: "BodyTransform", eyes: "Eyes", blink: "Blink" }).map(([key, name]) => {
      const node = artboard.node(name);
      if (!node) throw new Error(`Node ${name} ausente`);
      return [key, node];
    }));
    baseline = Object.fromEntries(Object.entries(nodes).map(([key, node]) => [key, Object.fromEntries(properties.map((property) => [property, node[property]]))]));
    const n = anatomy.neutral;
    if (baseline.root.x !== n.x || baseline.root.y !== n.y || baseline.root.rotation !== n.rotation || baseline.eyes.x !== n.eyeX || baseline.eyes.y !== n.eyeY || artboard.width !== anatomy.artboard.width || artboard.height !== anatomy.artboard.height) {
      throw new Error("Pose importada distinta del contrato neutral");
    }
    for (const [name, values] of Object.entries(baseline)) {
      if (values.scaleX !== 1 || values.scaleY !== 1 || !Object.values(values).every(Number.isFinite) || (name !== "root" && values.rotation !== 0)) throw new Error("Transformación neutral inválida");
    }
    actionSpecs = Object.fromEntries(await Promise.all(["happy_bounce", "curious_look"].map(async (name) => [name, await get(`/specs/${name}.json`, true)])));
    if (disposed) return;
    // Se carga un Artboard plano: nunca se crea Preview StateMachine.
    renderer = runtime.makeRenderer(canvas);
    pose = neutralPose(anatomy); target = { ...pose }; ready = true;
    canvas.addEventListener("pointerenter", follow);
    canvas.addEventListener("pointermove", follow);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointercancel", leave);
    canvas.addEventListener("click", clickBody);
    canvas.addEventListener("keydown", characterKey);
    curiosityButton.addEventListener("click", curiosity);
    window.addEventListener("blur", leave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    observer = new ResizeObserver(resize); observer.observe(canvas);
    message("Listo. Mueve el cursor para saludar.");
    wake();
  } catch (error) { if (!disposed) fail(error); }
}

function requestAction(name) {
  if (!ready || disposed || document.hidden) return;
  try {
    if (!lifecycle.request(name, actionSpecs[name].duration, capturePose())) { diagnose(); return; }
    const animation = artboard.animationByName(name);
    if (!animation) throw new Error(`Animación ${name} ausente`);
    actionInstance = new runtime.LinearAnimationInstance(animation, artboard);
    lastTime = performance.now();
    message(name === "happy_bounce" ? "Un pequeño salto de alegría." : "JEV observa con curiosidad.");
    wake(); diagnose();
  } catch (error) { fail(error); }
}

function clickBody(event) {
  if (!ready || disposed) return;
  try {
    if (hitBody(event.clientX, event.clientY, canvas.getBoundingClientRect(), anatomy, capturePose())) requestAction("happy_bounce");
  } catch (error) { fail(error); }
}

function curiosity() { requestAction("curious_look"); }

function characterKey(event) {
  handleActivationKey(event, document.activeElement === canvas, () => requestAction("happy_bounce"));
}

window.addEventListener("pagehide", cleanup, { once: true });
window.addEventListener("pageshow", (event) => { if (event.persisted && disposed) window.location.reload(); });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
