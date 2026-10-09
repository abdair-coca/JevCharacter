import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { acquirePresentationScroll, enablePresentationEngine, releaseIdlePresentationEngine, setPresentationVisibility } from "../presentation/scrollRuntime";
import { particlePhase, type StoryProgress } from "./particleGeometry";
import { cssDurationSeconds } from "../../lib/motionTokens";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** GSAP owns flight/progress; Canvas owns particle deformation, Rive the character. */
type StoryScrollOptions = { onScene: (index: number) => void; active: boolean; visible: boolean; reduced: boolean; preferenceKey: string; selected: number };
export function useStoryScroll(root: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>, { onScene, active, visible, reduced, preferenceKey, selected }: StoryScrollOptions) {
  const scroll = useRef<ReturnType<typeof acquirePresentationScroll> | null>(null);
  const selection = useRef(onScene);
  const selectedScene = useRef(selected);
  const locked = useRef(false);
  const unlock = useRef<number | null>(null);
  const preference = useRef(preferenceKey);
  const anchors = useRef<number[]>([]);
  const activity = useRef(active);
  const animations = useRef<{ pin: ScrollTrigger; journey: ScrollTrigger; settle: gsap.core.Tween } | null>(null);
  const progress = useRef(0) satisfies StoryProgress;
  useLayoutEffect(() => { selection.current = onScene; selectedScene.current = selected; activity.current = active; }, [onScene, selected, active]);

  const setAnimationsActive = useCallback((enabled: boolean) => {
    const resources = animations.current;
    if (!resources) return;
    // Pin positioning is scroll geometry, not an ambient animation. Disabling
    // it offscreen freezes the stage at the outro and creates an observer
    // deadlock on return. Only a hidden document suspends pin geometry.
    if (document.visibilityState === "hidden") resources.pin.disable(false);
    else { resources.pin.enable(false, false); resources.pin.update(); }
    if (enabled) {
      resources.journey.enable(false, false); resources.journey.update();
      resources.settle.resume();
    } else {
      resources.journey.disable(false);
      resources.settle.pause();
    }
  }, []);

  const offset = useCallback(() => document.querySelector(".site-header")!.getBoundingClientRect().bottom + Number.parseFloat(getComputedStyle(root.current!).getPropertyValue("--story-pin-gap")), [root]);

  useGSAP(() => {
    const element = root.current;
    const scene = stage.current;
    if (!element || !scene) return;
    enablePresentationEngine();
    const sections = Array.from(element.querySelectorAll<HTMLElement>("[data-story-scene]"));
    const select = (index: number) => { if (!locked.current) selection.current(index); };
    const triggers = sections.map((section, index) => ScrollTrigger.create({
      trigger: section, start: () => `top top+=${offset() + 1}`, end: () => `bottom top+=${offset() + 1}`,
      onEnter: () => select(index), onEnterBack: () => select(index),
    }));
    const media = gsap.matchMedia();
    if (!reduced) media.add("(prefers-reduced-motion: no-preference) and (height > 35rem)", () => {
      const css = getComputedStyle(element);
      const lease = acquirePresentationScroll(Number.parseFloat(css.getPropertyValue("--story-scroll-lerp")));
      lease.setActive(activity.current);
      scroll.current = lease;
      const flight = element.querySelector<HTMLElement>(".story-flight")!;
      const distance = () => scene.clientWidth * Number.parseFloat(getComputedStyle(element).getPropertyValue("--story-travel"));
      const pin = ScrollTrigger.create({ trigger: scene, start: () => `top top+=${offset()}`, endTrigger: element.querySelector(".story-workspace"), end: "bottom bottom", pin: true, pinSpacing: false, invalidateOnRefresh: true });
      const eased = { value: progress.current };
      const paint = () => {
        progress.current = eased.value;
        const phase = particlePhase(progress.current);
        const side = Math.min(4, Math.floor(progress.current)) % 2 === 0 ? 1 : -1;
        const x = (side - side * 2 * phase.morph) * distance();
        const y = Math.sin(progress.current * Math.PI) * scene.clientHeight * Number.parseFloat(css.getPropertyValue("--story-lift"));
        gsap.set(flight, { xPercent: -50, yPercent: -50, x, y });
        element.style.setProperty("--story-reveal", String(phase.reveal));
        element.dataset.storyProgress = progress.current.toFixed(3);
      };
      const follow = gsap.quickTo(eased, "value", { duration: cssDurationSeconds(css.getPropertyValue("--story-follow")), ease: "power2.out", onUpdate: paint });
      const update = () => {
        const top = window.scrollY + offset();
        const positions = sections.map(section => section.getBoundingClientRect().top + window.scrollY);
        let index = positions.findLastIndex(position => position <= top + 1);
        index = Math.max(0, index);
        const last = sections.at(-1)!;
        // Final chapter has extra scroll space for the star's hold and opening.
        const end = index < positions.length - 1 ? positions[index + 1] : positions[index] + last.offsetHeight - scene.offsetHeight;
        const fraction = Math.max(0, Math.min(1, (top - positions[index]) / Math.max(1, end - positions[index])));
        follow(index + fraction);
      };
      const journey = ScrollTrigger.create({ trigger: sections[0], start: () => `top top+=${offset()}`, endTrigger: sections.at(-1), end: "bottom bottom", onUpdate: update, onRefresh: update, invalidateOnRefresh: true });
      update();
      paint();
      animations.current = { pin, journey, settle: follow.tween };
      setAnimationsActive(activity.current);
      return () => {
        animations.current = null; follow.tween.kill(); pin.kill(); journey.kill();
        gsap.set(flight, { clearProps: "transform" });
        lease.release(); scroll.current = null; element.style.removeProperty("--story-reveal");
      };
    });
    ScrollTrigger.refresh();
    anchors.current = sections.map(section => section.getBoundingClientRect().top + window.scrollY);
    return () => {
      triggers.forEach(trigger => trigger.kill());
      media.revert();
      if (unlock.current !== null) cancelAnimationFrame(unlock.current);
      locked.current = false;
      releaseIdlePresentationEngine();
    };
  }, { scope: root, dependencies: [reduced, offset, setAnimationsActive], revertOnUpdate: true });

  useEffect(() => {
    // Section selection keeps working in linear/offscreen reading. Only the
    // document suspends the shared engine; each scene pauses its own visuals.
    setPresentationVisibility(visible);
    scroll.current?.setActive(active);
    setAnimationsActive(active);
  }, [active, visible, reduced, setAnimationsActive]);

  // Localization/details change the section heights. Keep the selected section's
  // viewport anchor, not its old absolute scroll offset, without moving focus.
  const refresh = useCallback(() => {
    const sections = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-story-scene]") ?? []);
    const index = selectedScene.current;
    if (!sections[index] || anchors.current[index] === undefined) return;
    locked.current = true;
    if (unlock.current !== null) cancelAnimationFrame(unlock.current);
    const next = sections.map(section => section.getBoundingClientRect().top + window.scrollY);
    const top = Math.max(0, window.scrollY + next[index] - anchors.current[index]);
    ScrollTrigger.refresh();
    if (scroll.current) scroll.current.scrollTo(top);
    else window.scrollTo({ top, behavior: "instant" });
    ScrollTrigger.update();
    anchors.current = next;
    unlock.current = requestAnimationFrame(() => { locked.current = false; unlock.current = null; });
  }, [root]);

  useLayoutEffect(() => {
    if (preference.current === preferenceKey) return;
    preference.current = preferenceKey;
    refresh();
  }, [preferenceKey, refresh]);

  const reveal = useCallback(() => {
    const last = root.current?.querySelector<HTMLElement>('[data-story-scene="4"]');
    if (!last || !stage.current || reduced) return;
    const top = last.getBoundingClientRect().top + window.scrollY - offset() + (last.offsetHeight - stage.current.offsetHeight) * 0.94;
    const duration = cssDurationSeconds(getComputedStyle(root.current!).getPropertyValue("--story-jump"));
    if (scroll.current) scroll.current.scrollTo(top, duration);
    else window.scrollTo({ top, behavior: "smooth" });
  }, [offset, reduced, root, stage]);

  return { refresh, progress, reveal };
}
