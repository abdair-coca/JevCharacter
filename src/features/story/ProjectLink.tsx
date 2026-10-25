import { useRef, type PointerEvent } from "react";
import { m, useSpring } from "motion/react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useOrganicMotion } from "../../lib/motionTokens";
import { STORY_ICONS } from "./icons";

/** A scene's project as a small card that says where it goes and leans toward a mouse. */
export function ProjectLink({ url, label }: { url: string; label: string }) {
  const { reduced, stiffness, damping } = useOrganicMotion();
  const magnetic = useMediaQuery("(hover: hover) and (pointer: fine)") && !reduced;
  const x = useSpring(0, { stiffness, damping });
  const y = useSpring(0, { stiffness, damping });
  const pull = useRef(0);
  const { host, pathname } = new URL(url);
  const destination = (host + pathname).replace(/\/$/, "");

  function enter(event: PointerEvent<HTMLAnchorElement>) {
    pull.current = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--story-magnet-pull"));
  }
  // Motion owns the link's transform; the card inside keeps the CSS lift.
  function lean(event: PointerEvent<HTMLAnchorElement>) {
    if (!magnetic || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - box.left - box.width / 2) * pull.current);
    y.set((event.clientY - box.top - box.height / 2) * pull.current);
  }
  function release() { x.set(0); y.set(0); }

  return (
    <m.a className="story-project__link" href={url} target="_blank" rel="noopener noreferrer" style={{ x, y }} onPointerEnter={enter} onPointerMove={lean} onPointerLeave={release}>
      <span className="story-project__card">
        <span className="story-project__icon" aria-hidden="true"><svg viewBox="0 0 24 24">{STORY_ICONS[host === "github.com" ? "github" : "web"]}</svg></span>
        <span className="story-project__text">
          <span className="story-project__label">{label}</span>
          <span className="story-project__url">{destination}</span>
        </span>
        <span className="story-project__arrow" aria-hidden="true">↗</span>
      </span>
    </m.a>
  );
}
