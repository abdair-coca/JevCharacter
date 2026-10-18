import { useEffect, useState, type RefObject } from "react";

export function useStageVisibility(stage: RefObject<HTMLElement | null>) {
  const [intersecting, setIntersecting] = useState(true);
  useEffect(() => {
    if (!stage.current || typeof IntersectionObserver === "undefined") return;
    // A batch can hold a stale position followed by the current one: the latest entry wins.
    const observer = new IntersectionObserver(entries => {
      const latest = entries.at(-1);
      if (latest) setIntersecting(latest.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [stage]);
  return intersecting;
}
