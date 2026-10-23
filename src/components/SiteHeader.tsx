import { lazy, Suspense, useCallback, useRef } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { navigate, type PageRoute, type Route } from "../navigation/routes";
import { usePreferences } from "../stores/preferencesStore";
import { closeMemory, closeSettings, openMemory, openSettings, useMemoryOpen, useSettingsOpen } from "../stores/settingsDialogStore";
import { toggleDiagnostics, useDiagnosticsActive } from "../stores/diagnosticsStore";
import { Button } from "./ui/button";
import { m } from "motion/react";
import { useThemeIconMotion, useUiMotion } from "../lib/motionTokens";

// Loaded only when they open.
const SettingsPanel = lazy(() => import("../features/settings/SettingsPanel"));
const MemoryPanel = lazy(() => import("../features/memory/MemoryPanel"));

// Shown instead of the labels on phones, so the whole bar fits in one row.
const NAV_ICONS: Record<Route, string> = {
  "/": "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z",
  "/features": "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z",
  "/about": "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z",
};

export default function SiteHeader({ route }: { route: PageRoute }) {
  const t = useTranslation();
  const theme = usePreferences((state) => state.theme);
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const transition = useUiMotion();
  const iconMotion = useThemeIconMotion();
  const settingsOpen = useSettingsOpen();
  const memoryOpen = useMemoryOpen();
  const diagnosticsActive = useDiagnosticsActive();
  const settingsButton = useRef<HTMLButtonElement | null>(null);
  // Focus goes back to whatever opened the panel, or to the gear when that control is gone.
  const onSettingsClose = useCallback(() => {
    const opener = closeSettings();
    requestAnimationFrame(() => (opener ?? settingsButton.current)?.focus({ preventScroll: true }));
  }, []);
  const onMemoryClose = useCallback(() => {
    const opener = closeMemory();
    requestAnimationFrame(() => (opener ?? settingsButton.current)?.focus({ preventScroll: true }));
  }, []);
  // Diagnostics read Home's sensors, so Ajustes offers them only there; the panel shows once Ajustes closes.
  const onToggleDiagnostics = useCallback(() => {
    toggleDiagnostics();
    onSettingsClose();
  }, [onSettingsClose]);
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
            <span className="brand-mark__name">JEVLING<span className="brand-mark__dot">.</span></span>
          </a>
          <nav aria-label={t.navigation}>
            {links.map(({ route: destination, label }) => (
              <a key={destination} href={destination} onClick={(event) => navigate(event, destination)} aria-current={route === destination ? "page" : undefined}>
                <svg className="site-header__icon" viewBox="0 0 24 24" aria-hidden="true"><path d={NAV_ICONS[destination]} /></svg>
                <span className="site-header__label">{label}</span>
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
            <Button ref={settingsButton} className="theme-toggle" variant="ghost" size="icon" aria-label={t.settings} aria-haspopup="dialog" title={t.settings} onClick={(event) => openSettings(event.currentTarget)}>
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
      {settingsOpen && <Suspense fallback={null}>
        <SettingsPanel onClose={onSettingsClose} onOpenMemory={openMemory}
          diagnostics={route === "/" ? { active: diagnosticsActive, onToggle: onToggleDiagnostics } : undefined} />
      </Suspense>}
      {memoryOpen && <Suspense fallback={null}><MemoryPanel onClose={onMemoryClose} /></Suspense>}
    </>
  );
}
