import type { Page } from "@playwright/test";
import { expect, restingBox, test } from "./fixtures";

const INPUT = "#creature-context";
const EVIDENCE = process.env.REPLY_EVIDENCE;

const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

const copy = {
  es: {
    ask: "¿qué carrera puedo estudiar?",
    spoken: "¡Te ayudo a elegir! ¿Qué te atrae más?",
    choices: { type: "choices", question: "¿Qué te atrae más de la tecnología?", options: ["Programar", "Diseñar interfaces", "Analizar datos", "Redes y seguridad"] },
    notes: ["Le gusta programar y los videojuegos.", "Necesita una carrera corta para trabajar pronto.", "Vive en Potosí y prefiere estudiar cerca de casa."],
    memory: "Memoria", title: "Lo que Jev recuerda", close: "Cerrar memoria", forget: "Olvidar", forgetAll: "Olvidar todo", empty: "Todavía no recuerdo nada de ti.",
  },
  en: {
    ask: "what career should I study?",
    spoken: "Let me help you choose! What draws you most?",
    choices: { type: "choices", question: "What draws you most to technology?", options: ["Coding", "Designing interfaces", "Analyzing data", "Networks and security"] },
    notes: ["User loves coding and video games.", "Needs a short degree to start working soon.", "Lives in Potosí and prefers to study close to home."],
    memory: "Memory", title: "What Jev remembers", close: "Close memory", forget: "Forget", forgetAll: "Forget everything", empty: "I don't remember anything about you yet.",
  },
} as const;

type Language = keyof typeof copy;

/** Seeds preferences and three notes (stored oldest first), then opens Home with a reply that asks with options. */
async function open(page: Page, language: Language, theme: "light" | "dark") {
  const notes = copy[language].notes.map((text, index, all) => ({ id: `n${index}`, text, createdAt: Date.now() - (all.length - index) * 3_600_000 }));
  // Seeds once per tab, so a reload keeps what the test changed. Frames without storage are skipped.
  await page.addInitScript(([lang, mode, stored]) => {
    try {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      window.localStorage.setItem("jevling.language", JSON.stringify(lang));
      window.localStorage.setItem("jevling.theme", JSON.stringify(mode));
      window.localStorage.setItem("jevling.memory", JSON.stringify({ version: 1, notes: stored }));
    } catch {
      // about:blank and sandboxed frames deny storage access.
    }
  }, [language, theme, notes] as const);
  const { spoken, choices } = copy[language];
  const body = `event: spoken\ndata: ${JSON.stringify({ text: spoken })}\n\nevent: block\ndata: ${JSON.stringify({ block: choices })}\n\nevent: done\ndata: {}\n\n`;
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  await page.route("**/api/talk", route => route.fulfill({ status: 200, contentType: "text/event-stream", body }));
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
}

async function settled(page: Page, scope: string) {
  await expect.poll(() => page.locator(scope).first().evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
}

async function noPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.vertical).toBeLessThanOrEqual(1);
  expect(overflow.horizontal).toBeLessThanOrEqual(1);
}

const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

for (const language of ["es", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const device of ["desktop", "mobile"] as const) {
      test(`options and memory panel in ${language}/${theme}/${device}`, async ({ page }) => {
        await page.setViewportSize(viewports[device]);
        await open(page, language, theme);
        const text = copy[language];

        await page.locator(INPUT).fill(text.ask);
        await page.locator(INPUT).press("Enter");
        const scope = device === "desktop" ? ".reply-card" : ".reply-sheet";
        await expect(page.locator(scope).getByRole("button", { name: text.choices.options[0] })).toBeVisible();
        await settled(page, scope);
        await noPageOverflow(page);
        if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/choices-${device}-${language}-${theme}.png` });

        // On phones the reply is a modal sheet: close it to reach the footer.
        if (device === "mobile") {
          await page.keyboard.press("Escape");
          await expect(page.locator(".reply-sheet")).toHaveCount(0);
        }
        await page.getByRole("button", { name: text.memory, exact: true }).click();
        const dialog = page.getByRole("dialog", { name: text.title });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("listitem")).toHaveCount(3);
        // Newest first.
        await expect(dialog.getByRole("listitem").first()).toContainText(text.notes[2]);
        // The sheet slides up on entry: measure where it comes to rest, never mid-animation.
        await settled(page, ".memory");
        const box = await restingBox(dialog);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewports[device].width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewports[device].height);
        if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/memory-${device}-${language}-${theme}.png` });

        await dialog.getByRole("button", { name: text.close }).click();
        await expect(dialog).toHaveCount(0);
      });
    }
  }
}

test("the memory panel works from the keyboard and what it forgets stays forgotten", async ({ page }) => {
  await open(page, "es", "light");
  const text = copy.es;
  const memoryButton = page.getByRole("button", { name: text.memory, exact: true });
  await memoryButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: text.title });
  await expect(dialog.getByRole("heading", { name: text.title })).toBeFocused();

  await dialog.getByRole("button", { name: `${text.forget}: ${text.notes[2]}` }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: `${text.forget}: ${text.notes[1]}` })).toBeFocused();

  // Tab stays inside the dialog.
  for (let step = 0; step < 6; step++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".memory")))).toBe(true);

  await dialog.getByRole("button", { name: text.forgetAll }).click();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dialog.getByRole("button", { name: text.forgetAll }).last().click();
  await expect(dialog.getByText(text.empty)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(memoryButton).toBeFocused();

  await page.reload();
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: text.memory, exact: true }).click();
  await expect(page.getByText(text.empty)).toBeVisible();
});

test("reduced motion opens the memory panel without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "es", "light");
  await page.getByRole("button", { name: copy.es.memory, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: copy.es.title });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => getComputedStyle(element).opacity)).toBe("1");
});
