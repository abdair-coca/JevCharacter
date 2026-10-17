import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import SiteHeader from "./components/SiteHeader";
import HomePage from "./pages/HomePage";
import { rememberScroll, savedScroll, useRoute } from "./navigation/routes";
import { preferencesStore, usePreferences } from "./stores/preferencesStore";
import { useTranslation } from "./i18n/useTranslation";
import { useSoundRuntime } from "./lib/useSoundRuntime";
import "./App.css";

const PendingPage = lazy(() => import("./pages/PendingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const loadMotionFeatures = () => import("./lib/motionFeatures").then((module) => module.default);
const SCROLL_RESTORE_MS = 2500;

export default function App() {
  const route = useRoute();
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);
  const t = useTranslation();
  const previousRoute = useRef(route);
  const [homeVisited, setHomeVisited] = useState(route === "/");
  useSoundRuntime();

  useEffect(() => { if (route === "/") setHomeVisited(true); }, [route]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    const styles = getComputedStyle(document.documentElement);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", styles.getPropertyValue("--neutral-background").trim());
  }, [theme, language]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => preferencesStore.getState().syncSystemTheme(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    document.title = `JEVLING — ${route === "/" ? `${t.title} ${t.titleAccent}` : route === "/features" ? t.features : route === "/about" ? t.about : t.notFound}`;
  }, [route, t]);

  useEffect(() => {
    // The app restores each history entry's position itself, after lazy routes mount.
    window.history.scrollRestoration = "manual";
    let timer: number | undefined;
    const onScroll = () => { window.clearTimeout(timer); timer = window.setTimeout(rememberScroll, 150); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", rememberScroll);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", rememberScroll);
    };
  }, []);

  useEffect(() => {
    // Focus once the lazy destination is mounted, without remounting Home. A new
    // visit starts at the top; back/forward and reload return to the saved position.
    const changed = previousRoute.current !== route;
    previousRoute.current = route;
    const target = savedScroll();
    if (!changed && target === 0) return;
    let cancelled = false;
    const deadline = performance.now() + SCROLL_RESTORE_MS;
    // Presentations grow as their scenes and pins are measured: retry until the
    // position is reachable, within a bounded time (Features keeps its load gate).
    const settle = () => {
      if (cancelled) return;
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) > 1 && performance.now() < deadline) frame = requestAnimationFrame(settle);
    };
    const focus = () => {
      if (cancelled) return;
      const heading = document.querySelector<HTMLElement>(`[data-page-route="${route}"]`);
      if (!heading) { frame = requestAnimationFrame(focus); return; }
      if (changed) heading.focus({ preventScroll: true });
      settle();
    };
    let frame = requestAnimationFrame(focus);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [route]);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <SiteHeader route={route} />
        {(homeVisited || route === "/") && (
          <div className="home-session" hidden={route !== "/"} inert={route !== "/"}>
            <HomePage active={route === "/"} />
          </div>
        )}
        <Suspense fallback={<main className="pending-page" aria-busy="true" />}>
          {route === "/features" ? <FeaturesPage /> : route === "/about" ? <AboutPage /> : route !== "/" && <PendingPage route={route} />}
        </Suspense>
      </LazyMotion>
    </MotionConfig>
  );
}
