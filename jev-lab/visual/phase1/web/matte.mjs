/**
 * Neutral original circular: interior opaco, luz exterior sobre un matte negro.
 * Conserva exactamente RGB/alpha dentro del cuerpo; fuera reconstruye luz
 * premultiplicada para que sobre negro reproduzca el render original.
 */
export function extractBlackMatte(pixels, width, height, centerX, centerY, radius) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 <= radius ** 2) continue;
      const offset = (y * width + x) * 4;
      const maximum = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      const originalAlpha = pixels[offset + 3];
      pixels[offset + 3] = Math.round(maximum * originalAlpha / 255);
      if (maximum > 0) {
        for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round(pixels[offset + channel] * 255 / maximum);
      }
    }
  }
  return pixels;
}
