/** Loads an image for particle sampling; aborts with its owner and gives up after 12 s. */
export function loadImage(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
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

/** A soft glow drawn once and stamped for a few particles each frame. */
export function glowSprite(color: string) {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, color); gradient.addColorStop(0.15, color); gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
  return canvas;
}
