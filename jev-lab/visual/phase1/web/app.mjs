import { validateComparison, bodyTransform } from "/geometry.mjs";
import { extractBlackMatte } from "/matte.mjs";

const status = document.getElementById("status");
const capture = document.getElementById("capture");
const diagnostics = document.getElementById("diagnostics");
const abort = new AbortController();
const resources = [];
const renderers = [];
let runtime, config, observer, disposed = false, ready = false, frame = null, background = "dark";

async function get(url, json = false) {
  const response = await fetch(url, { signal: abort.signal, cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return json ? response.json() : response.arrayBuffer();
}

function alignBody(renderer, body, targetWidth, width, height) {
  const transform = bodyTransform(body, targetWidth, width, height);
  const halfWidth = width / transform.scale / 2, halfHeight = height / transform.scale / 2;
  renderer.align(runtime.Fit.contain, runtime.Alignment.center,
    { minX: 0, minY: 0, maxX: width, maxY: height },
    { minX: body.centerX - halfWidth, minY: body.centerY - halfHeight,
      maxX: body.centerX + halfWidth, maxY: body.centerY + halfHeight });
}

function matteOriginal(resource, canvas, targetWidth) {
  if (resource.version.id !== "original") return;
  const context = canvas.getContext("2d");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  extractBlackMatte(image.data, canvas.width, canvas.height, canvas.width / 2, canvas.height / 2, targetWidth / 2);
  context.putImageData(image, 0, 0);
}

function draw(resource, canvas, renderer, targetWidth, raw = false) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  renderer.clear();
  renderer.save();
  if (raw) {
    renderer.align(runtime.Fit.contain, runtime.Alignment.center,
      { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }, resource.artboard.bounds);
  } else {
    alignBody(renderer, resource.version.body, targetWidth * dpr, canvas.width, canvas.height);
  }
  resource.artboard.draw(renderer);
  renderer.restore();
  renderer.flush();
  runtime.resolveAnimationFrame();
  if (!raw) matteOriginal(resource, canvas, targetWidth * dpr);
}

function redraw() {
  frame = null;
  if (!ready || disposed || document.hidden) return;
  try {
    for (const resource of resources) {
      for (const panel of resource.panels) draw(resource, panel.canvas, panel.renderer, panel.width);
    }
    const raw = document.getElementById("raw-original");
    if (!raw.hidden) draw(resources[0], raw, resources[0].rawRenderer, 0, true);
    diagnostics.dataset.state = "neutral";
    diagnostics.dataset.framePending = "false";
  } catch (error) { fail(error); }
}

function wake() {
  if (!ready || disposed || document.hidden || frame !== null) return;
  frame = runtime.requestAnimationFrame(redraw);
  diagnostics.dataset.framePending = "true";
}

function cleanup() {
  if (disposed) return;
  disposed = true;
  abort.abort(); observer?.disconnect();
  if (frame !== null) runtime?.cancelAnimationFrame(frame);
  frame = null;
  for (const renderer of renderers) renderer.delete();
  for (const resource of resources) {
    resource.machine?.delete();
    resource.artboard?.delete();
    resource.instance?.unref();
    resource.file?.unref();
  }
  runtime?.cleanup?.();
  capture.disabled = true;
  diagnostics.dataset.state = "disposed";
  diagnostics.dataset.framePending = "false";
}

function fail(error) {
  status.textContent = `No se pudo completar la comparación: ${error.message}. Revisa el servidor y recarga.`;
  console.error(error);
  cleanup();
  diagnostics.dataset.state = "error";
  status.textContent = `No se pudo completar la comparación: ${error.message}. Revisa el servidor y recarga.`;
}

async function start() {
  try {
    config = validateComparison(await get("/comparison.json", true));
    if (!window.rive?.RuntimeLoader) throw new Error("Runtime Rive local ausente");
    window.rive.RuntimeLoader.setWasmUrl("/rive.wasm");
    window.rive.RuntimeLoader.setWasmFallbackUrl(null);
    runtime = await window.rive.RuntimeLoader.awaitInstance();
    if (disposed) { runtime.cleanup?.(); return; }
    for (const version of config.versions) {
      const file = await runtime.load(new Uint8Array(await get(version.url)), undefined, false);
      if (disposed) { file.unref(); return; }
      const resource = { file, version, panels: [] };
      resources.push(resource);
      resource.artboard = file.artboardByName(version.artboard);
      if (!resource.artboard) throw new Error(`Artboard ${version.artboard} ausente`);
      const artboard = resource.artboard;
      // El original se carga plano primero. No se reproduce ninguna animación.
      if (version.id === "original") {
        const model = file.viewModelByName("ViewModel1");
        resource.instance = model?.instanceByName("Instance");
        if (resource.instance) {
          resource.instance.enum("state").value = "Base";
          resource.instance.boolean("followBoo").value = false;
          artboard.bindViewModelInstance(resource.instance);
        }
        const base = artboard.animationByName("Base");
        if (!base) throw new Error("Pose Base del original ausente");
        const pose = new runtime.LinearAnimationInstance(base, artboard);
        try { pose.advance(0); pose.apply(1); } finally { pose.delete(); }
        resource.initialization = "ViewModel Base, followBoo=false; Base aplicada t=0; sin avance temporal";
      }
      artboard.advance(0);
      const card = document.createElement("article");
      card.className = `card ${version.id}`;
      const header = document.createElement("header");
      const title = document.createElement("h2"); title.textContent = version.label;
      const description = document.createElement("p"); description.textContent = version.description;
      header.append(title, description); card.append(header);
      for (const [name, width] of Object.entries(config.sizes)) {
        const label = document.createElement("div"); label.className = "stage-label";
        label.textContent = `${name === "normal" ? "NORMAL" : "PEQUEÑO"} · ${width} PX DE CUERPO`;
        const stage = document.createElement("div"); stage.className = `stage ${name}`;
        const canvas = document.createElement("canvas"); canvas.setAttribute("aria-label", `${version.label}, cuerpo ${width} píxeles`);
        canvas.dataset.version = version.id; canvas.dataset.size = name;
        const renderer = runtime.makeRenderer(canvas, true); renderers.push(renderer);
        resource.panels.push({ canvas, renderer, width });
        stage.append(canvas); card.append(label, stage);
      }
      document.getElementById("comparison").append(card);
      if (version.id === "original") {
        resource.rawRenderer = runtime.makeRenderer(document.getElementById("raw-original"), true);
        renderers.push(resource.rawRenderer);
      }
    }
    if (disposed) return;
    diagnostics.textContent = JSON.stringify(resources.map(({ version, artboard, instance, initialization }) => ({ id: version.id, artboard: version.artboard, width: artboard.width, height: artboard.height, body: version.body, state: instance?.enum("state").value || "neutral", follow: instance?.boolean("followBoo").value ?? false, initialization, autoplay: false })), null, 2);
    document.getElementById("calibration").textContent = config.versions.map(version => `${version.label}: ${version.calibration}.`).join(" ");
    ready = true;
    status.textContent = "Tres versiones listas. Neutral congelado; compara ambos tamaños.";
    capture.disabled = false;
    observer = new ResizeObserver(wake);
    for (const resource of resources) for (const panel of resource.panels) observer.observe(panel.canvas);
    wake();
  } catch (error) { if (!disposed) fail(error); }
}

for (const button of document.querySelectorAll("[data-background]")) {
  button.addEventListener("click", () => {
    if (!ready || disposed) return;
    background = button.dataset.background;
    document.documentElement.style.setProperty("--stage-background", config.backgrounds[background]);
    for (const sibling of document.querySelectorAll("[data-background]")) sibling.setAttribute("aria-pressed", String(sibling === button));
    wake();
  }, { signal: abort.signal });
}

document.getElementById("raw").addEventListener("click", () => {
  const raw = document.getElementById("raw-original"); raw.hidden = !raw.hidden; wake();
}, { signal: abort.signal });

document.getElementById("raw-download").addEventListener("click", () => {
  if (!ready || disposed) return;
  const raw = document.getElementById("raw-original"); raw.hidden = false;
  draw(resources[0], raw, resources[0].rawRenderer, 0, true); runtime.resolveAnimationFrame();
  raw.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "jev-original-neutral-raw.png"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}, { signal: abort.signal });

capture.addEventListener("click", () => {
  if (!ready || disposed) return;
  try {
    const sheet = document.createElement("canvas"); sheet.width = 1800; sheet.height = 1370;
    const context = sheet.getContext("2d"); context.fillStyle = "#0c0b11"; context.fillRect(0, 0, sheet.width, sheet.height);
    context.fillStyle = "#eee9f8"; context.font = "bold 34px Segoe UI"; context.fillText("JEV · Comparación neutral · Fase 1", 40, 55);
    let y = 90;
    for (const [theme, color] of Object.entries(config.backgrounds)) {
      context.fillStyle = "#bba8d0"; context.font = "20px Segoe UI"; context.fillText(`${theme === "dark" ? "Fondo oscuro" : "Fondo claro"} · 140 / 48 px de cuerpo`, 40, y + 25);
      y += 45;
      for (let index = 0; index < resources.length; index += 1) {
        const resource = resources[index], x = index * 600;
        context.fillStyle = "#eee9f8"; context.font = "24px Segoe UI"; context.fillText(resource.version.label, x + 40, y + 25);
        for (const [row, width] of Object.values(config.sizes).entries()) {
          const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = row === 0 ? 330 : 150;
          const renderer = runtime.makeRenderer(canvas, true);
          try {
            renderer.clear(); renderer.save();
            alignBody(renderer, resource.version.body, width * 2, canvas.width, canvas.height);
            resource.artboard.draw(renderer); renderer.restore(); renderer.flush();
            runtime.resolveAnimationFrame();
            matteOriginal(resource, canvas, width * 2);
            const top = y + 45 + (row === 0 ? 0 : 330);
            context.fillStyle = color; context.fillRect(x, top, 600, canvas.height);
            context.drawImage(canvas, x, top);
          } finally { renderer.delete(); }
        }
      }
      y += 580;
    }
    sheet.toBlob(blob => {
      if (!blob) { status.textContent = "No se pudo exportar la captura."; return; }
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "jev-fase1-comparacion.png"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Captura descargada: ambos fondos y tamaños.";
    }, "image/png");
  } catch (error) { status.textContent = `No se pudo exportar la captura: ${error.message}`; }
}, { signal: abort.signal });

document.addEventListener("visibilitychange", () => {
  if (document.hidden && frame !== null) { runtime.cancelAnimationFrame(frame); frame = null; diagnostics.dataset.framePending = "false"; }
  else wake();
}, { signal: abort.signal });
window.addEventListener("pagehide", cleanup, { once: true });
window.addEventListener("pageshow", event => { if (event.persisted && disposed) window.location.reload(); });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
