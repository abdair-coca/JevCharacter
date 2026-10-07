import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import SiteHeader from "./components/SiteHeader";
import HomePage from "./pages/HomePage";
import { useRoute } from "./navigation/routes";
import { preferencesStore, usePreferences } from "./stores/preferencesStore";
import { useTranslation } from "./i18n/useTranslation";
import "./App.css";

const PendingPage = lazy(() => import("./pages/PendingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const loadMotionFeatures = () => import("./lib/motionFeatures").then((module) => module.default);

export default function App() {
  const route = useRoute();
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);
  const t = useTranslation();
  const previousRoute = useRef(route);
  const [homeVisited, setHomeVisited] = useState(route === "/");

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
    // Focus once the lazy destination is mounted, without remounting Home.
    if (previousRoute.current === route) return;
    previousRoute.current = route;
    let cancelled = false;
    const focus = () => {
      if (cancelled) return;
      const heading = document.querySelector<HTMLElement>(`[data-page-route="${route}"]`);
      if (heading) { heading.focus({ preventScroll: true }); window.scrollTo(0, 0); }
      else frame = requestAnimationFrame(focus);
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
          {route === "/features" ? <FeaturesPage /> : route !== "/" && <PendingPage route={route} />}
        </Suspense>
      </LazyMotion>
    </MotionConfig>
  );
}
