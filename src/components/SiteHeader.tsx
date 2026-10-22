import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { navigate, type PageRoute, type Route } from "../navigation/routes";
import { usePreferences } from "../stores/preferencesStore";
import { Button } from "./ui/button";
import { m } from "motion/react";
import { useThemeIconMotion, useUiMotion } from "../lib/motionTokens";

// Loaded only when the settings open.
const SettingsPanel = lazy(() => import("../features/settings/SettingsPanel"));

export default function SiteHeader({ route }: { route: PageRoute }) {
  const t = useTranslation();
  const theme = usePreferences((state) => state.theme);
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const transition = useUiMotion();
  const iconMotion = useThemeIconMotion();
  // The panel belongs to the page it opened on: changing route closes it, with no effect needed.
  const [settingsRoute, setSettingsRoute] = useState<PageRoute | null>(null);
  const settingsOpen = settingsRoute === route;
  const settingsButton = useRef<HTMLButtonElement | null>(null);
  // Focus goes back to the gear that opened the panel.
  const closeSettings = useCallback(() => {
    setSettingsRoute(null);
    requestAnimationFrame(() => settingsButton.current?.focus({ preventScroll: true }));
  }, []);
  const links: { route: Route; label: string }[] = [
    { route: "/", label: t.home }, { route: "/features", label: t.features }, { route: "/about", label: t.about },
  ];
  return (
    <>
      <a className="skip-link" href="#page-title">{t.skip}</a>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand-mark" href="/" onClick={(event) => navigate(event, "/")} aria-label="Jevling">
            <span className="brand-mark__glyph" aria-hidden="true">••</span>
            <span>JEVLING<span className="brand-mark__dot">.</span></span>
          </a>
          <nav aria-label={t.navigation}>
            {links.map(({ route: destination, label }) => (
              <a key={destination} href={destination} onClick={(event) => navigate(event, destination)} aria-current={route === destination ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="preferences">
            <Button className="theme-toggle" variant="ghost" size="icon" aria-label={t.theme} aria-pressed={theme === "dark"} title={theme === "dark" ? t.light : t.dark} onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}>
              <span className="theme-toggle__icons" aria-hidden="true">
                <m.svg className="theme-toggle__sun" viewBox="0 0 24 24" initial={false} animate={{ opacity: theme === "light" ? 1 : 0, rotate: theme === "light" ? 0 : iconMotion.turn, scale: theme === "light" ? 1 : iconMotion.scale }} transition={transition}>
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                </m.svg>
                <m.svg className="theme-toggle__moon" viewBox="0 0 24 24" initial={false} animate={{ opacity: theme === "dark" ? 1 : 0, rotate: theme === "dark" ? 0 : -iconMotion.turn, scale: theme === "dark" ? 1 : iconMotion.scale }} transition={transition}>
                  <path d="M20.8 13.2A9 9 0 0 1 10.8 3.1 9 9 0 1 0 20.8 13.2Z" />
                </m.svg>
              </span>
            </Button>
            <Button ref={settingsButton} className="theme-toggle" variant="ghost" size="icon" aria-label={t.settings} aria-haspopup="dialog" title={t.settings} onClick={() => setSettingsRoute(route)}>
              <span className="theme-toggle__icons" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
            </Button>
          </div>
        </div>
      </header>
      {settingsOpen && <Suspense fallback={null}><SettingsPanel onClose={closeSettings} /></Suspense>}
    </>
  );
}
