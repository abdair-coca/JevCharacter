import { m } from "motion/react";

const points = Array.from({ length: 48 }, (_, index) => {
  const angle = index * 2.399963;
  const radius = 180 + (index % 7) * 36;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, size: 1.5 + index % 4, delay: (index % 6) / 30 };
});

/** A finite decorative burst; no canvas, personal data or continuous ticker. */
export function EnrollmentParticles({ duration, celebrate }: { duration: number; celebrate: boolean }) {
  if (!duration) return null;
  return <svg className="enrollment-particles" viewBox="0 0 1000 1000" aria-hidden="true">
    <m.circle className="enrollment-particles__ring" cx="500" cy="500" r="310"
      initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.1], opacity: [0, 0.55, 0] }} transition={{ duration }} />
    {points.map((point, index) => <m.circle key={index} cx="500" cy="500" r={point.size}
      className={index % 3 === 0 ? "enrollment-particles__accent" : undefined}
      initial={{ x: celebrate ? 0 : point.x, y: celebrate ? 0 : point.y, opacity: 0 }}
      animate={{ x: celebrate ? point.x : point.x * 0.35, y: celebrate ? point.y : point.y * 0.35, opacity: [0, 0.9, 0], scale: [0.5, 1.4, 0.3] }}
      transition={{ duration, delay: point.delay, ease: "easeOut" }} />)}
  </svg>;
}
