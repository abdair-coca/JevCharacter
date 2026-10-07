import { useRef } from "react";
import { m } from "motion/react";
import type { BrainStatus } from "../creature/brain/brain.types";
import { useAmbientMotion } from "../hooks/useAmbientMotion";
import { useOrganicMotion } from "../lib/motionTokens";

type Props = { status: BrainStatus; attention: number; emphasized?: boolean };

export default function OrganicLight({ status, attention, emphasized = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const running = useAmbientMotion(ref);
  const motion = useOrganicMotion();
  const duration = status === "deciding" ? motion.consider : motion.breathe;
  const strength = Math.max(0, Math.min(1, attention));
  const low = motion.opacityLow;
  const high = emphasized ? motion.opacityHigh : low + (motion.opacityHigh - low) * strength;

  return (
    <span ref={ref} className="organic-light" data-running={running} data-activity={status} aria-hidden="true">
      <m.span className="organic-light__bloom" initial={false}
        animate={running ? { opacity: [low, high, low], scale: [1, motion.scale, 1], rotate: [-motion.turn, motion.turn, -motion.turn] } : { opacity: low, scale: 1, rotate: 0 }}
        transition={running ? { duration, repeat: Infinity, ease: motion.ease } : { duration: 0 }} />
      <m.span className="organic-light__ribbon" initial={false}
        animate={running ? { opacity: [high, low, high], scaleX: [1, motion.scale, 1] } : { opacity: low, scaleX: 1 }}
        transition={running ? { duration, repeat: Infinity, ease: motion.ease } : { duration: 0 }} />
    </span>
  );
}
