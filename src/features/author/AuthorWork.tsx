import type { PointerEvent } from "react";
import { m } from "motion/react";
import type { Language } from "../../stores/preferencesStore";
import { navigate } from "../../navigation/routes";
import { useOrganicMotion, useUiMotion } from "../../lib/motionTokens";
import { STORY_SCENES } from "../story/catalog";
import { StillImage } from "../story/StillImage";
import { AUTHOR_WORK, authorCopy } from "./catalog";

/** The card leans toward a mouse and a light follows it; CSS applies both only where hover exists. */
function lean(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const box = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  event.currentTarget.style.setProperty("--lean-x", (x * 2 - 1).toFixed(3));
  event.currentTarget.style.setProperty("--lean-y", (y * 2 - 1).toFixed(3));
}
function settle(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--lean-x", "0");
  event.currentTarget.style.setProperty("--lean-y", "0");
}

/** «Aprendo construyendo»: the story's projects as cards that rise in turn, each opening its project. */
export function AuthorWork({ language, reduced }: { language: Language; reduced: boolean }) {
  const copy = authorCopy[language];
  const transition = useUiMotion();
  const { stagger } = useOrganicMotion();
  return (
    <section className="author-work" aria-labelledby="author-work-title">
      <p className="author-eyebrow">{copy.work}</p>
      <h2 id="author-work-title">{copy.workTitle}</h2>
      <p className="author-section-lead">{copy.workLead}</p>
      <ul className="author-cards">
        {AUTHOR_WORK.map((item, index) => {
          const scene = STORY_SCENES.find(candidate => candidate.id === item.scene)!;
          const external = "projectUrl" in scene;
          return (
            <m.li key={item.scene} initial={{ opacity: 0, y: "var(--author-rise)" }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ ...transition, delay: index * stagger }}>
              <article className="author-card" data-project={item.scene} onPointerMove={lean} onPointerLeave={settle}>
                <div className="author-card__media">
                  {scene.image === null
                    ? <span className="author-jev" aria-hidden="true"><span className="author-jev__eyes">••</span></span>
                    : "animated" in scene && reduced ? <StillImage src={scene.image} alt={scene.caption[language]} /> : <img src={scene.image} alt="" loading="lazy" />}
                  <span className="author-card__glare" aria-hidden="true" />
                </div>
                <div className="author-card__body">
                  <h3>{item.name}</h3>
                  <p>{scene.lead[language]}</p>
                  {external
                    ? <a className="author-card__link" href={scene.projectUrl} target="_blank" rel="noopener noreferrer" aria-label={`${copy.project}: ${item.name}`}>{copy.project} <span aria-hidden="true">↗</span></a>
                    : <a className="author-card__link" href="/" onClick={event => navigate(event, "/")}>{copy.meetJev} <span aria-hidden="true">↗</span></a>}
                </div>
              </article>
            </m.li>
          );
        })}
      </ul>
    </section>
  );
}
