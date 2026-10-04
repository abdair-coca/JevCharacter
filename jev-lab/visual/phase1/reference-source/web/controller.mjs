// Tres controles de seguimiento; sin reproducción de animaciones.
function require(condition, message) {
  if (!condition) throw new Error(message);
}

function finite(value, label) {
  require(Number.isFinite(value), `${label} debe ser finito`);
  return value;
}

export function validateSettings(settings, anatomy) {
  const n = anatomy.neutral;
  const limits = anatomy.limits;
  require(anatomy.artboard.width > 0 && anatomy.artboard.height > 0, "Artboard inválido");
  for (const axis of ["x", "y"]) {
    const range = finite(settings.eyeRange[axis], `eyeRange.${axis}`);
    require(range > 0 && range <= (axis === "x" ? 8 : 5), "Mirada excede límites de esta fase");
    const base = n[axis === "x" ? "eyeX" : "eyeY"];
    const bounds = limits[axis === "x" ? "eyeX" : "eyeY"];
    require(base - range >= bounds[0] && base + range <= bounds[1], "Mirada excede contrato corporal");
  }
  const tilt = finite(settings.rotationDegrees, "rotationDegrees");
  require(tilt > 0 && tilt <= 2, "Inclinación excede límites de esta fase");
  require(-tilt >= limits.rotationDegrees[0] && tilt <= limits.rotationDegrees[1], "Inclinación excede contrato corporal");
  require(settings.tauMs.eyes === 70 && settings.tauMs.body === 140, "Timing de fase 1 inválido");
  for (const value of Object.values(settings.snapTolerance)) {
    require(finite(value, "snapTolerance") > 0 && value < 0.01, "Tolerancia inválida");
  }
  return settings;
}

export function neutralPose(anatomy) {
  return { eyeX: anatomy.neutral.eyeX, eyeY: anatomy.neutral.eyeY, rotation: anatomy.neutral.rotation };
}

export function mapContain(clientX, clientY, rect, artboard) {
  for (const value of [clientX, clientY, rect.left, rect.top, rect.width, rect.height, artboard.width, artboard.height]) {
    finite(value, "Coordenada");
  }
  require(rect.width > 0 && rect.height > 0 && artboard.width > 0 && artboard.height > 0, "Superficie sin tamaño");
  const scale = Math.min(rect.width / artboard.width, rect.height / artboard.height);
  const left = rect.left + (rect.width - artboard.width * scale) / 2;
  const top = rect.top + (rect.height - artboard.height * scale) / 2;
  return { x: (clientX - left) / scale, y: (clientY - top) / scale };
}

export function pointerTarget(clientX, clientY, rect, anatomy, settings) {
  const point = mapContain(clientX, clientY, rect, anatomy.artboard);
  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const horizontal = clamp((point.x - anatomy.neutral.x) / (anatomy.artboard.width / 2));
  const vertical = clamp((point.y - anatomy.neutral.y) / (anatomy.artboard.height / 2));
  return {
    eyeX: anatomy.neutral.eyeX + horizontal * settings.eyeRange.x,
    eyeY: anatomy.neutral.eyeY + vertical * settings.eyeRange.y,
    rotation: anatomy.neutral.rotation + horizontal * settings.rotationDegrees * Math.PI / 180,
  };
}

export function approachPose(current, target, seconds, settings) {
  require(finite(seconds, "Tiempo") >= 0, "Tiempo negativo");
  const approach = (value, goal, tauMs) => value + (goal - value) * (-Math.expm1(-seconds * 1000 / tauMs));
  return {
    eyeX: approach(current.eyeX, target.eyeX, settings.tauMs.eyes),
    eyeY: approach(current.eyeY, target.eyeY, settings.tauMs.eyes),
    rotation: approach(current.rotation, target.rotation, settings.tauMs.body),
  };
}

export function settlePose(current, target, settings) {
  const settled = Math.abs(current.eyeX - target.eyeX) <= settings.snapTolerance.eyes
    && Math.abs(current.eyeY - target.eyeY) <= settings.snapTolerance.eyes
    && Math.abs(current.rotation - target.rotation) <= settings.snapTolerance.rotation;
  return { pose: settled ? { ...target } : current, settled };
}
