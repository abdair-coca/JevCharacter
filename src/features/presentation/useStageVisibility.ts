import { useEffect, useState, type RefObject } from "react";

export function useStageVisibility(stage: RefObject<HTMLElement | null>) {
  const [intersecting, setIntersecting] = useState(true);
  useEffect(() => {
    if (!stage.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [stage]);
  return intersecting;
}
