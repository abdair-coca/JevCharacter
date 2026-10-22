import type { Page } from "@playwright/test";
import { expect, restingBox, test } from "./fixtures";

const EVIDENCE = process.env.SETTINGS_EVIDENCE;
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const KEY = "gsk_test_visible_key_1234567890";

type Language = "es" | "en";
const copy: Record<Language, { gear: string; key: string; save: string; saved: string; invalid: string }> = {
  es: { gear: "Ajustes", key: "Clave API", save: "Guardar clave", saved: "Clave guardada en este navegador.", invalid: "Revisa la clave: debe tener entre 20 y 200 caracteres, sin espacios." },
  en: { gear: "Settings", key: "API key", save: "Save key", saved: "Key saved in this browser.", invalid: "Check the key: it must be 20 to 200 characters, without spaces." },
};

/** Seeds language and theme once per tab, then opens Home. */
async function open(page: Page, language: Language, theme: "light" | "dark") {
  await page.addInitScript(([lang, mode]) => {
    try {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      window.localStorage.setItem("jevling.language", JSON.stringify(lang));
      window.localStorage.setItem("jevling.theme", JSON.stringify(mode));
    } catch {
      // about:blank and sandboxed frames deny storage access.
    }
  }, [language, theme] as const);
  await page.goto("/");
  await expect(page.locator("#creature-context")).toBeVisible({ timeout: 45_000 });
}

for (const language of ["es", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const device of ["desktop", "mobile"] as const) {
      test(`settings panel in ${language}/${theme}/${device}`, async ({ page }) => {
        await page.setViewportSize(viewports[device]);
        await open(page, language, theme);
        const text = copy[language];

        await page.getByRole("button", { name: text.gear, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: text.gear });
        await expect(dialog).toBeVisible();
        // The panel slides up on entry: measure where it comes to rest, never mid-animation.
        const box = await restingBox(dialog);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewports[device].width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewports[device].height);

        const field = page.getByLabel(text.key);
        await field.fill("corta");
        await page.getByRole("button", { name: text.save }).click();
        await expect(field).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByText(text.invalid)).toBeVisible();

        await field.fill(KEY);
        await page.getByRole("button", { name: text.save }).click();
        await expect(dialog.getByRole("status")).toHaveText(text.saved);
        await expect(field).toHaveValue("");
        if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/settings-${device}-${language}-${theme}.png` });

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("button", { name: text.gear, exact: true })).toBeFocused();
      });
    }
  }
}
