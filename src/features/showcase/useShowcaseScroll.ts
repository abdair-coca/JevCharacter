import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { acquirePresentationScroll, enablePresentationEngine, releaseIdlePresentationEngine, setPresentationVisibility } from "../presentation/scrollRuntime";
import { cssDurationSeconds } from "../../lib/motionTokens";
import { clampToLimit, isGatedDownwards, keyScrollsDown } from "./scrollGate";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// One presentation owns global smooth scroll. GSAP's ticker is the sole RAF driver.
export function useShowcaseScroll(root: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>, onChapter: (index: number) => void, visible: boolean, reduced: boolean, preferenceKey: string, selected: number, gated = false) {
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

  // Target offset of a chapter card, shared by jumps and the gate limit.
  const targetTop = useCallback((index: number) => {
    const element = root.current;
    const target = element?.querySelector<HTMLElement>(`[data-chapter-card="${index}"]`);
    if (!element || !target) return null;
    const offset = document.querySelector(".site-header")!.getBoundingClientRect().bottom + Number.parseFloat(getComputedStyle(element).getPropertyValue("--showcase-pin-gap"));
    return Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  }, [root]);

  // While Jev is not painted, the scroll stops at the start of "Percibe". Native and smooth gestures are both stopped at window capture.
  useEffect(() => {
    if (!gated) return;
    const element = root.current;
    if (!element) return;
    const blocked = () => {
      const top = targetTop(0);
      return top !== null && isGatedDownwards(window.scrollY, top);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY <= 0 || !blocked()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    let lastTouchY: number | null = null;
    const onTouchStart = (event: TouchEvent) => { lastTouchY = event.touches[0]?.clientY ?? null; };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined || lastTouchY === null) return;
      const delta = lastTouchY - y;
      lastTouchY = y;
      if (delta <= 0 || !blocked()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!keyScrollsDown(event.key) || !blocked()) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // Anchors, jumps and restoration can bypass gestures; return any overshoot to the limit.
    const onScroll = () => {
      const top = targetTop(0);
      if (top === null) return;
      const clamped = clampToLimit(window.scrollY, top);
      if (clamped !== null) window.scrollTo({ top: clamped, behavior: "instant" });
    };
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart, { capture: true });
      window.removeEventListener("touchmove", onTouchMove, { capture: true });
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("scroll", onScroll);
    };
  }, [gated, root, targetTop]);

  // Returns false when the gate blocks the jump, so the caller keeps the current chapter.
  return useCallback((index: number) => {
    const top = targetTop(index);
    if (top === null) return false;
    const limitTop = targetTop(0);
    if (gated && limitTop !== null && top > limitTop + 1) return false;
    const duration = reduced ? 0 : cssDurationSeconds(getComputedStyle(root.current!).getPropertyValue("--showcase-jump"));
    if (scroll.current) scroll.current.scrollTo(top, duration);
    else window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    return true;
  }, [gated, reduced, root, targetTop]);
}
