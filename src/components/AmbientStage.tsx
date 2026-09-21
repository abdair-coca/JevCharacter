type Props = {
  intensity: number;
  wantsAttention: number;
};

const PARTICLES = [
  [9, 24, 0, 0.7],
  [18, 72, -3.2, 0.45],
  [28, 38, -7.1, 0.6],
  [37, 83, -1.6, 0.8],
  [43, 17, -5.4, 0.45],
  [51, 68, -8.2, 0.72],
  [58, 29, -2.1, 0.5],
  [67, 78, -6.3, 0.65],
  [73, 20, -9.2, 0.74],
  [82, 58, -4.4, 0.52],
  [89, 34, -7.7, 0.67],
  [94, 80, -1.1, 0.42],
] as const;

export default function AmbientStage({ intensity, wantsAttention }: Props) {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__mesh" />
      <div className="ambient__pointer" />
      <div className="ambient__horizon" />
      <div
        className="ambient__attention"
        style={{ opacity: 0.08 + wantsAttention * 0.18 + intensity * 0.03 }}
      />
      <div className="ambient__orbit ambient__orbit--one" />
      <div className="ambient__orbit ambient__orbit--two" />
      <div className="ambient__particles">
        {PARTICLES.map(([left, top, delay, scale], index) => (
          <i
            key={`${left}-${top}`}
            className={index % 3 === 0 ? "ambient__particle ambient__particle--bright" : "ambient__particle"}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${delay}s`,
              transform: `scale(${scale})`,
            }}
          />
        ))}
      </div>
      <div className="ambient__grain" />
      <div className="ambient__vignette" />
    </div>
  );
}
