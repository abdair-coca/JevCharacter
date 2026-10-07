import { useTranslation } from "../i18n/useTranslation";
import { navigate, type PageRoute, type Route } from "../navigation/routes";
import { usePreferences } from "../stores/preferencesStore";
import { Button } from "./ui/button";
import { m } from "motion/react";
import { useThemeIconMotion, useUiMotion } from "../lib/motionTokens";

export default function SiteHeader({ route }: { route: PageRoute }) {
  const t = useTranslation();
  const language = usePreferences((state) => state.language);
  const setLanguage = usePreferences((state) => state.setLanguage);
  const theme = usePreferences((state) => state.theme);
  const setThemePreference = usePreferences((state) => state.setThemePreference);
  const transition = useUiMotion();
  const iconMotion = useThemeIconMotion();
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
            <div className="language-switch" data-language={language} role="group" aria-label={t.language}>
              <m.span className="language-switch__indicator" aria-hidden="true" initial={false} animate={{ x: language === "en" ? "100%" : "0%" }} transition={transition} />
              <Button variant="ghost" size="small" aria-pressed={language === "es"} aria-label="Español" onClick={() => setLanguage("es")}>ES</Button>
              <Button variant="ghost" size="small" aria-pressed={language === "en"} aria-label="English" onClick={() => setLanguage("en")}>EN</Button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
