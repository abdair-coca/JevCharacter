import { mapContain } from "./controller.mjs";

const ENTRY_BLEND_SECONDS = 0.08;

// Un único dueño: seguimiento, clip, un frame neutral y seguimiento otra vez.
export class ActionLifecycle {
  constructor() {
    this.active = null;
    this.neutralFrame = false;
    this.acceptedRequests = 0;
    this.ignoredRequests = 0;
  }

  get busy() { return this.active !== null || this.neutralFrame; }

  request(name, duration, startPose) {
    if (this.busy) { this.ignoredRequests += 1; return false; }
    if (!["happy_bounce", "curious_look"].includes(name) || !Number.isFinite(duration) || duration <= ENTRY_BLEND_SECONDS) throw new Error("Acción inválida");
    this.active = { name, duration, elapsed: 0, startPose: structuredClone(startPose) };
    this.acceptedRequests += 1;
    return true;
  }

  tick(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Tiempo de acción inválido");
    if (this.active) {
      const action = this.active;
      action.elapsed = Math.min(action.duration, action.elapsed + seconds);
      if (action.elapsed >= action.duration) {
        this.active = null;
        this.neutralFrame = true;
        return { owner: "neutral", completed: action };
      }
      const progress = Math.min(1, action.elapsed / ENTRY_BLEND_SECONDS);
      return { owner: "action", action, mix: progress * progress * (3 - 2 * progress) };
    }
    if (this.neutralFrame) { this.neutralFrame = false; return { owner: "tracking", resumed: true }; }
    return { owner: "tracking", resumed: false };
  }

  cancel() { this.active = null; this.neutralFrame = false; }
}

// Restaura la pose capturada en cada frame mezclado; el mix no se acumula.
export function applyActionFrame(nodes, baseline, action, mix, instance) {
  const source = mix < 1 ? action.startPose : baseline;
  for (const [name, values] of Object.entries(source)) {
    for (const [property, value] of Object.entries(values)) nodes[name][property] = value;
  }
  instance.apply(mix);
}

// El rol button del canvas necesita activación explícita; repetir no encola.
export function handleActivationKey(event, focused, activate) {
  if (!focused || !["Enter", " "].includes(event.key)) return false;
  event.preventDefault();
  if (!event.repeat) activate();
  return true;
}

// Una pestaña oculta libera el clip y restaura todos los canales capturados.
export function suspendAction(lifecycle, instance, nodes, baseline) {
  const canceled = lifecycle.busy;
  lifecycle.cancel();
  instance?.delete();
  for (const [name, values] of Object.entries(baseline)) {
    for (const [property, value] of Object.entries(values)) nodes[name][property] = value;
  }
  return canceled;
}

export function hitBody(clientX, clientY, rect, anatomy, transforms) {
  let point = mapContain(clientX, clientY, rect, anatomy.artboard);
  for (const transform of [transforms.root, transforms.bodyTransform]) {
    if (![transform.x, transform.y, transform.rotation, transform.scaleX, transform.scaleY].every(Number.isFinite) || transform.scaleX <= 0 || transform.scaleY <= 0) throw new Error("Transformación de hit test inválida");
    const x = point.x - transform.x, y = point.y - transform.y;
    const cosine = Math.cos(transform.rotation), sine = Math.sin(transform.rotation);
    point = { x: (cosine * x + sine * y) / transform.scaleX, y: (-sine * x + cosine * y) / transform.scaleY };
  }
  const halfWidth = anatomy.body.width / 2, halfHeight = anatomy.body.height / 2;
  const radius = Math.min(anatomy.body.roundness, halfWidth, halfHeight);
  if (Math.abs(point.x) > halfWidth || Math.abs(point.y) > halfHeight) return false;
  const dx = Math.max(Math.abs(point.x) - (halfWidth - radius), 0);
  const dy = Math.max(Math.abs(point.y) - (halfHeight - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}
