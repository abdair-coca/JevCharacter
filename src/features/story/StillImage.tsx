import { useEffect, useRef, useState } from "react";

/**
 * Shows the first frame of an animated image, so the static reading never moves.
 * It loads only when it nears the viewport, like the lazy images it replaces.
 */
export function StillImage({ src, alt }: { src: string; alt: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const image = new Image();
    image.onload = () => {
      element.width = image.naturalWidth;
      element.height = image.naturalHeight;
      element.getContext("2d")?.drawImage(image, 0, 0);
    };
    image.onerror = () => setFailed(true);
    const load = () => { image.src = src; };
    if (typeof IntersectionObserver === "undefined") load();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer?.disconnect();
      load();
    }, { rootMargin: "50% 0px" });
    observer?.observe(element);
    return () => { observer?.disconnect(); image.onload = null; image.onerror = null; };
  }, [src]);

  return failed ? null : <canvas ref={canvas} className="story-still" role="img" aria-label={alt} />;
}
