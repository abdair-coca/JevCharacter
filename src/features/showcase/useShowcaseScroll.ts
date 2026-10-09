import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { acquirePresentationScroll, enablePresentationEngine, releaseIdlePresentationEngine, setPresentationVisibility } from "../presentation/scrollRuntime";
import { cssDurationSeconds } from "../../lib/motionTokens";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// One presentation owns global smooth scroll. GSAP's ticker is the sole RAF driver.
export function useShowcaseScroll(root: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>, onChapter: (index: number) => void, visible: boolean, reduced: boolean, preferenceKey: string, selected: number) {
  const scroll = useRef<ReturnType<typeof acquirePresentationScroll> | null>(null);
  const select = useRef(onChapter);
  const locked = useRef(false);
  const unlockFrame = useRef<number | null>(null);
  const preference = useRef(preferenceKey);
  const anchors = useRef<number[]>([]);
  useEffect(() => { select.current = onChapter; }, [onChapter]);

  useGSAP(() => {
    const element = root.current;
    const scene = stage.current;
    if (!element || !scene) return;
    enablePresentationEngine();
    const media = gsap.matchMedia();
    const cards = Array.from(element.querySelectorAll<HTMLElement>("[data-chapter-card]"));
    const offset = () => document.querySelector(".site-header")!.getBoundingClientRect().bottom + Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-pin-gap"));
    const selectCard = (index: number) => { if (!locked.current) select.current(index); };
    const triggers = cards.map((card, index) => ScrollTrigger.create({ trigger: card, start: () => `top top+=${offset() + 1}`, end: () => `bottom top+=${offset() + 1}`, onEnter: () => selectCard(index), onEnterBack: () => selectCard(index) }));
    if (!reduced) media.add("(prefers-reduced-motion: no-preference)", () => {
      const lease = acquirePresentationScroll(Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-scroll-lerp")));
      scroll.current = lease;
      return () => {
        lease.release();
        scroll.current = null;
      };
    });
    if (!reduced) media.add("(prefers-reduced-motion: no-preference) and (height > 35rem)", () => {
      const pin = ScrollTrigger.create({ trigger: scene, start: () => `top top+=${offset()}`, endTrigger: element.querySelector(".showcase-workspace"), end: "bottom bottom", pin: true, pinSpacing: false, invalidateOnRefresh: true });
      // GSAP owns the free-flight wrapper; Rive owns the creature, Motion its caption.
      const flight = element.querySelector<HTMLElement>(".showcase-flight")!;
      const distance = () => scene.clientWidth * Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-travel"));
      const lift = () => scene.clientHeight * Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-lift"));
      gsap.set(flight, { xPercent: -50, yPercent: -50 });
      const travel = gsap.timeline({ scrollTrigger: { trigger: cards[0], start: () => `top top+=${offset()}`, endTrigger: cards[cards.length - 1], end: () => `top top+=${offset()}`, scrub: cssDurationSeconds(getComputedStyle(element).getPropertyValue("--showcase-follow")), invalidateOnRefresh: true } });
      cards.slice(1).forEach((card, step) => {
        const index = step + 1;
        const destination = { x: () => (index % 2 === 0 ? 1 : -1) * distance(), y: () => (index % 2 === 0 ? -1 : 1) * lift(), rotation: () => (index % 2 === 0 ? -1 : 1) * Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-bank")), duration: card.offsetTop - cards[index - 1].offsetTop, ease: "sine.inOut" };
        if (index === 1) travel.fromTo(flight, { x: () => distance(), y: () => -lift(), rotation: 0 }, destination);
        else travel.to(flight, destination);
      });
      return () => { pin.kill(); };
    });
    ScrollTrigger.refresh();
    anchors.current = cards.map(card => card.getBoundingClientRect().top + window.scrollY);
    return () => {
      triggers.forEach(trigger => trigger.kill());
      media.revert();
      if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current);
      locked.current = false;
      releaseIdlePresentationEngine();
    };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  useEffect(() => {
    scroll.current?.setActive(visible);
    setPresentationVisibility(visible);
  }, [visible, reduced]);

  useLayoutEffect(() => {
    if (preference.current === preferenceKey) return;
    preference.current = preferenceKey;
    const cards = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-chapter-card]") ?? []);
    if (!cards[selected] || anchors.current[selected] === undefined) return;
    locked.current = true;
    if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current);
    const next = cards.map(card => card.getBoundingClientRect().top + window.scrollY);
    const top = Math.max(0, window.scrollY + next[selected] - anchors.current[selected]);
    ScrollTrigger.refresh();
    if (scroll.current) scroll.current.scrollTo(top);
    else window.scrollTo({ top, behavior: "instant" });
    ScrollTrigger.update();
    anchors.current = next;
    unlockFrame.current = requestAnimationFrame(() => { locked.current = false; unlockFrame.current = null; });
  }, [preferenceKey, selected, root]);

  return useCallback((index: number) => {
    const target = root.current?.querySelector<HTMLElement>(`[data-chapter-card="${index}"]`);
    if (!target) return;
    const offset = document.querySelector(".site-header")!.getBoundingClientRect().bottom + Number.parseFloat(getComputedStyle(root.current!).getPropertyValue("--showcase-pin-gap"));
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    const duration = reduced ? 0 : cssDurationSeconds(getComputedStyle(root.current!).getPropertyValue("--showcase-jump"));
    if (scroll.current) scroll.current.scrollTo(top, duration);
    else window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
  }, [root, reduced]);
}
