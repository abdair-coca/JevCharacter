import type { Page } from "@playwright/test";
import { expect, restingBox, test } from "./fixtures";

const EVIDENCE = process.env.SETTINGS_EVIDENCE;
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const KEY = "gsk_test_visible_key_1234567890";

type Language = "es" | "en";
const VOICE_KEY = "AIza_test_visible_key_1234567890";
const copy: Record<Language, { gear: string; groq: string; key: string; save: string; saved: string; invalid: string; voice: string; voiceKey: string; voiceSave: string; voiceSaved: string; privacy: string }> = {
  es: {
    gear: "Ajustes", groq: "Clave de Groq", key: "Clave API", save: "Guardar clave", saved: "Clave guardada en este navegador.", invalid: "Revisa la clave: debe tener entre 20 y 200 caracteres, sin espacios.",
    voice: "Voz de Jev (Google)", voiceKey: "Clave de voz", voiceSave: "Guardar clave de voz", voiceSaved: "Clave guardada en este navegador. Jev habla con su voz.",
    privacy: "En el nivel gratuito, Google puede usar el texto que Jev dice para mejorar sus productos.",
  },
  en: {
    gear: "Settings", groq: "Groq key", key: "API key", save: "Save key", saved: "Key saved in this browser.", invalid: "Check the key: it must be 20 to 200 characters, without spaces.",
    voice: "Jev's voice (Google)", voiceKey: "Voice key", voiceSave: "Save voice key", voiceSaved: "Key saved in this browser. Jev speaks with its voice.",
    privacy: "On the free tier, Google may use the text Jev says to improve its products.",
  },
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

        const groq = dialog.getByRole("region", { name: text.groq });
        const field = groq.getByLabel(text.key, { exact: true });
        await field.fill("corta");
        await groq.getByRole("button", { name: text.save, exact: true }).click();
        await expect(field).toHaveAttribute("aria-invalid", "true");
        await expect(groq.getByText(text.invalid)).toBeVisible();

        await field.fill(KEY);
        await groq.getByRole("button", { name: text.save, exact: true }).click();
        await expect(groq.getByRole("status")).toHaveText(text.saved);
        await expect(field).toHaveValue("");
        if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/settings-${device}-${language}-${theme}.png` });

        // Jev's voice key sits in its own section, with Google's free-tier note.
        const voice = dialog.getByRole("region", { name: text.voice });
        await expect(voice.getByText(text.privacy)).toBeVisible();
        const voiceField = voice.getByLabel(text.voiceKey, { exact: true });
        await voiceField.fill(VOICE_KEY);
        await voice.getByRole("button", { name: text.voiceSave, exact: true }).click();
        await expect(voice.getByRole("status")).toHaveText(text.voiceSaved);
        await expect(voiceField).toHaveValue("");
        const voiceBox = await voice.boundingBox();
        expect(voiceBox && voiceBox.x + voiceBox.width).toBeLessThanOrEqual(viewports[device].width);
        if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/settings-voice-${device}-${language}-${theme}.png` });

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("button", { name: text.gear, exact: true })).toBeFocused();
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`phones show the views as icons in a single header row (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await open(page, "es", theme);
    const header = (await page.locator(".site-header").boundingBox())!;
    // Only the logo: the name is hidden, the link keeps its accessible name.
    await expect(page.locator(".brand-mark__name")).toBeHidden();
    await expect(page.getByRole("link", { name: "Jevling" })).toBeVisible();
    const gear = (await page.getByRole("button", { name: "Ajustes", exact: true }).boundingBox())!;
    for (const name of ["Inicio", "Capacidades", "Historia", "Abdair"]) {
      const link = page.getByRole("link", { name });
      await expect(link.locator(".site-header__icon")).toBeVisible();
      await expect(link.locator(".site-header__label")).toHaveCSS("clip-path", "inset(50%)");
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(48);
      // Same row as the gear, between the brand and the theme button.
      expect(Math.abs(box.y + box.height / 2 - (gear.y + gear.height / 2))).toBeLessThanOrEqual(2);
    }
    expect(header.height).toBeLessThanOrEqual(72);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    // The current view's icon takes the text color: white on dark, near-black on light.
    const icon = await page.getByRole("link", { name: "Inicio" }).evaluate(link => getComputedStyle(link).color);
    expect(icon).toBe(await page.evaluate(() => getComputedStyle(document.body).color));
  });
}

test("Diagnóstico opens from Ajustes on Home only", async ({ page }) => {
  await open(page, "es", "dark");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Diagnóstico" }).click();
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Diagnóstico" })).toBeVisible();
  await expect(page.locator(".home-footer")).toHaveCount(0);

  await page.getByRole("link", { name: "Historia" }).click();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Ajustes" });
  await expect(dialog.getByRole("button", { name: "Memoria" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Diagnóstico" })).toHaveCount(0);
});

for (const device of ["desktop", "mobile"] as const) {
  test(`Jev's color stays inside the panel and survives a reload on ${device}`, async ({ page }) => {
    await page.setViewportSize(viewports[device]);
    await open(page, "es", "dark");
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ajustes" });
    const panel = await restingBox(dialog);
    const swatches = dialog.getByRole("group", { name: "Color de Jev" }).getByRole("button");
    await expect(swatches).toHaveCount(6);
    for (const swatch of await swatches.all()) {
      const box = (await swatch.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    }

    await dialog.getByRole("button", { name: "Cian" }).click();
    await expect(dialog.getByRole("button", { name: "Cian" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("#creature-context")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Ajustes", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ajustes" }).getByRole("button", { name: "Cian" })).toHaveAttribute("aria-pressed", "true");
  });
}
