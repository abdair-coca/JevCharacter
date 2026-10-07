import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Runtime = { lenis: Lenis; clients: Map<symbol, boolean>; tick: (seconds: number) => void; ticking: boolean };
let runtime: Runtime | null = null;
// registerPlugin enables ScrollTrigger once. Repeated enable() calls would add
// another global RAF workaround and interval, so subsequent activation is gated.
let engineEnabled = true;

export function enablePresentationEngine() {
  if (!engineEnabled) { ScrollTrigger.enable(); engineEnabled = true; }
}

export function setPresentationVisibility(visible: boolean) {
  if (visible) enablePresentationEngine();
  else if (engineEnabled && document.visibilityState === "hidden") {
    ScrollTrigger.disable(false);
    engineEnabled = false;
    gsap.ticker.sleep();
  }
}

function sync(value: Runtime) {
  const active = [...value.clients.values()].some(Boolean);
  if (active === value.ticking) return;
  value.ticking = active;
  value.lenis.options.smoothWheel = active;
  if (active) { value.lenis.start(); gsap.ticker.add(value.tick); }
  else {
    // Stop interpolation, then unlock native scrolling. Intro/outro must remain
    // reachable while the scene's smooth-scroll RAF driver is asleep.
    value.lenis.stop(); value.lenis.start();
    gsap.ticker.remove(value.tick);
    if (document.visibilityState === "hidden") gsap.ticker.sleep();
  }
}

/** Shared, reference-counted global scroll. No route can create a second Lenis. */
export function acquirePresentationScroll(lerp: number) {
  if (!runtime) {
    const lenis = new Lenis({ autoRaf: false, lerp, prevent: node => Boolean(node.closest("[data-lenis-prevent], input, textarea, select")) });
    lenis.on("scroll", ScrollTrigger.update);
    runtime = { lenis, clients: new Map(), tick: seconds => lenis.raf(seconds * 1000), ticking: false };
  }
  const value = runtime;
  const id = Symbol("presentation");
  let released = false;
  value.clients.set(id, document.visibilityState !== "hidden");
  sync(value);
  return {
    scrollTo: (top: number) => { if (!released) value.lenis.scrollTo(top, { immediate: true, force: true }); },
    setActive: (active: boolean) => { if (!released) { value.clients.set(id, active); sync(value); } },
    release: () => {
      if (released) return;
      released = true;
      value.clients.delete(id);
      sync(value);
      if (value.clients.size === 0) {
        gsap.ticker.remove(value.tick);
        value.lenis.off("scroll", ScrollTrigger.update);
        value.lenis.destroy();
        runtime = null;
      }
    },
  };
}

export function releaseIdlePresentationEngine() {
  // Never disable triggers or animations belonging to another presentation.
  if (!runtime && ScrollTrigger.getAll().length === 0) {
    if (engineEnabled) ScrollTrigger.disable();
    engineEnabled = false;
    if (!gsap.globalTimeline.getChildren().some(animation => animation.isActive())) gsap.ticker.sleep();
  }
}
