import "./loading.css";

type Props = {
  /** False once Jev is revealed; the loader then fades out as she fades in. */
  visible: boolean;
  /** Dots only animate while the page is visible. */
  active: boolean;
  reduced: boolean;
};

// Three pulsing dots shown while Jev is not yet revealed. Decorative: the page's own status copy carries meaning.
export default function CreatureLoader({ visible, active, reduced }: Props) {
  return (
    <div className="creature-loader" data-visible={visible} data-active={active} data-reduced={reduced} aria-hidden="true">
      <span className="creature-loader__dot" />
      <span className="creature-loader__dot" />
      <span className="creature-loader__dot" />
    </div>
  );
}
