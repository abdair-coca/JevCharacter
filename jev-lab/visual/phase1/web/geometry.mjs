export function validateComparison(config) {
  if (config.schema !== 1 || config.versions.length !== 3) throw new Error("Configuración de comparación inválida");
  for (const value of [...Object.values(config.sizes), config.viewport.width, config.viewport.height]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error("Tamaño de comparación inválido");
  }
  for (const version of config.versions) {
    const { centerX, centerY, width, height } = version.body;
    if (![centerX, centerY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error("Calibración corporal inválida");
  }
  return config;
}

export function bodyTransform(body, targetWidth, viewportWidth, viewportHeight) {
  const scale = targetWidth / body.width;
  return { scale, x: viewportWidth / 2 - body.centerX * scale, y: viewportHeight / 2 - body.centerY * scale };
}
