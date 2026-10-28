import { useRef, type CSSProperties, type PointerEvent } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import type { Language } from "../../stores/preferencesStore";
import { navigate } from "../../navigation/routes";
import { STORY_SCENES } from "../story/catalog";
import { StillImage } from "../story/StillImage";
import { AUTHOR_WORK, authorCopy } from "./catalog";

/** A light follows the mouse across the scene; CSS shows it only where hover exists. */
function follow(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--pointer-x", (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
  event.currentTarget.style.setProperty("--pointer-y", (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
}

/**
 * «Aprendo construyendo»: each project is a scene that holds the screen until the next one rises over it.
 * Motion reads the stack's progress; CSS turns it into each scene's depth (shrink and shade) and arrival.
 */
export function AuthorWork({ language, reduced }: { language: Language; reduced: boolean }) {
  const copy = authorCopy[language];
  const stack = useRef<HTMLUListElement | null>(null);
  const { scrollYProgress } = useScroll({ target: stack, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", value => stack.current?.style.setProperty("--stack", value.toFixed(4)));

  // A focused link under later scenes would be hidden: scroll back to where its scene lands on top.
  function surface(index: number) {
    if (reduced) return;
    const list = stack.current!;
    const scene = list.children[index] as HTMLElement;
    const style = getComputedStyle(scene);
    if (style.position !== "sticky") return;
    const landing = list.getBoundingClientRect().top + window.scrollY + index * scene.offsetHeight - Number.parseFloat(style.top);
    if (window.scrollY > landing + 1) window.scrollTo({ top: landing, behavior: "instant" });
  }

  return (
    <section className="author-work" aria-labelledby="author-work-title">
      <p className="author-eyebrow">{copy.work}</p>
      <h2 id="author-work-title">{copy.workTitle}</h2>
      <p className="author-section-lead">{copy.workLead}</p>
      <ul className="author-stack" ref={stack} style={{ "--count": AUTHOR_WORK.length } as CSSProperties}>
        {AUTHOR_WORK.map((item, index) => {
          const scene = STORY_SCENES.find(candidate => candidate.id === item.scene)!;
          const external = "projectUrl" in scene;
          return (
            <li key={item.scene} className="author-scene" style={{ "--i": index } as CSSProperties}>
              <article className="author-scene__card" data-project={item.scene} onPointerMove={follow}>
                <div className="author-scene__media">
                  <div className="author-scene__frame">
                    {scene.image === null
                      ? <span className="author-jev" aria-hidden="true"><span className="author-jev__eyes">••</span></span>
                      : "animated" in scene && reduced ? <StillImage src={scene.image} alt={scene.caption[language]} /> : <img src={scene.image} alt="" loading="lazy" />}
                  </div>
                </div>
                <div className="author-scene__body">
                  <h3>{item.name}</h3>
                  <div className="author-scene__about">
                    <p>{scene.lead[language]}</p>
                    <ul className="author-tags" aria-label={copy.tags}>
                      {item.tags[language].map(tag => <li key={tag}>{tag}</li>)}
                    </ul>
                    {external
                      ? <a className="author-scene__link" href={scene.projectUrl} target="_blank" rel="noopener noreferrer" aria-label={`${copy.project}: ${item.name}`} onFocus={() => surface(index)}>{copy.project} <span aria-hidden="true">↗</span></a>
                      : <a className="author-scene__link" href="/" onClick={event => navigate(event, "/")} onFocus={() => surface(index)}>{copy.meetJev} <span aria-hidden="true">↗</span></a>}
                  </div>
                </div>
                <span className="author-scene__glare" aria-hidden="true" />
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
