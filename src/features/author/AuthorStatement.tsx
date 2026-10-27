import { Fragment, useRef, type CSSProperties } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import type { Language } from "../../stores/preferencesStore";
import { authorCopy, statementWords } from "./catalog";

/**
 * The interests sentence, held on screen while its words light up one by one with the scroll.
 * Motion reads the progress; CSS turns it into each word's light. The static reading shows it lit.
 */
export function AuthorStatement({ language }: { language: Language }) {
  const copy = authorCopy[language];
  const section = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start 0.7", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", value => section.current?.style.setProperty("--statement", value.toFixed(4)));
  const words = statementWords(copy.statement);
  return (
    <section ref={section} className="author-statement" aria-labelledby="author-interests" style={{ "--statement-count": words.length } as CSSProperties}>
      <div className="author-statement__pin">
        <p className="author-eyebrow" id="author-interests">{copy.interests}</p>
        <p className="author-statement__text">
          {words.map((word, index) => (
            <Fragment key={`${language}-${index}`}>
              {index > 0 && " "}
              <span className={word.key ? "author-word author-word--key" : "author-word"} style={{ "--i": index } as CSSProperties}>{word.text}</span>
            </Fragment>
          ))}
        </p>
      </div>
    </section>
  );
}
