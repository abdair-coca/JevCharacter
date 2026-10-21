import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const INPUT = "#creature-context";
const EVIDENCE = process.env.REPLY_EVIDENCE;

const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

const replies = {
  es: {
    spoken: "Te los comparo en un momento.",
    blocks: [
      { type: "paragraph", text: "Ambos son buenas mascotas, pero piden cosas distintas cada día.", emphasis: ["cosas distintas"] },
      { type: "compare", columns: [{ title: "Gatos", points: ["Independientes", "Poco espacio"] }, { title: "Perros", points: ["Sociables", "Paseos diarios"] }] },
      { type: "steps", items: ["Mide tu tiempo libre.", "Revisa tu espacio.", "Visita un refugio."] },
      { type: "highlight", value: "15 años", label: "Vida media de un gato doméstico" },
      { type: "callout", tone: "warning", text: "Consulta alergias antes de adoptar." },
      { type: "chips", items: ["¿Cuál cuesta menos?", "¿Y para niños?"] },
    ],
  },
  en: {
    spoken: "Let me compare them for you.",
    blocks: [
      { type: "paragraph", text: "Both are great pets, but they need different things every day.", emphasis: ["different things"] },
      { type: "compare", columns: [{ title: "Cats", points: ["Independent", "Little space"] }, { title: "Dogs", points: ["Social", "Daily walks"] }] },
      { type: "list", items: ["Check your free time.", "Look at your space.", "Visit a shelter."] },
      { type: "highlight", value: "15 years", label: "Average life of a house cat" },
      { type: "callout", tone: "tip", text: "Ask about allergies before adopting." },
      { type: "chips", items: ["Which costs less?", "What about kids?"] },
    ],
  },
} as const;

const labels = {
  es: { region: "Respuesta de Jev", dialog: "Jev responde", followUp: "Preguntas para seguir", unavailable: "El habla no está disponible" },
  en: { region: "Jev's reply", dialog: "Jev says", followUp: "Follow-up questions", unavailable: "Speech is unavailable" },
} as const;

type Language = keyof typeof replies;

function sse({ spoken, blocks }: { spoken: string; blocks: readonly unknown[] }) {
  return [
    `event: spoken\ndata: ${JSON.stringify({ text: spoken })}\n\n`,
    ...blocks.map(block => `event: block\ndata: ${JSON.stringify({ block })}\n\n`),
    "event: done\ndata: {}\n\n",
  ].join("");
}

async function open(page: Page, language: Language, theme: "light" | "dark") {
  await page.addInitScript(([lang, mode]) => {
    window.localStorage.setItem("jevling.language", JSON.stringify(lang));
    window.localStorage.setItem("jevling.theme", JSON.stringify(mode));
  }, [language, theme] as const);
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  await page.route("**/api/talk", route => route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(replies[language]) }));
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
}

async function send(page: Page, text: string) {
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
}

// Waits until every entrance animation inside the reply has finished.
async function settled(page: Page, scope: string) {
  await expect.poll(() => page.locator(scope).evaluate(element =>
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

for (const language of ["es", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`desktop blocks render in ${language}/${theme}`, async ({ page }) => {
      await open(page, language, theme);
      await send(page, language === "es" ? "compara gatos y perros" : "compare cats and dogs");
      const region = page.getByRole("region", { name: labels[language].region });
      await expect(region).toBeVisible();
      await expect(region.locator(".reply-compare__column")).toHaveCount(2);
      await expect(region.locator(".reply-emphasis")).toHaveCount(1);
      await expect(region.getByRole("navigation", { name: labels[language].followUp }).getByRole("button")).toHaveCount(2);
      await settled(page, ".reply-card");
      await noPageOverflow(page);
      // Side by side in the desktop card.
      const [first, second] = await region.locator(".reply-compare__column").all();
      expect((await second.boundingBox())!.x).toBeGreaterThan((await first.boundingBox())!.x + 50);
      if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/blocks-desktop-${language}-${theme}.png` });
    });

    test(`mobile blocks render in ${language}/${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, language, theme);
      await send(page, language === "es" ? "compara gatos y perros" : "compare cats and dogs");
      const dialog = page.getByRole("dialog", { name: labels[language].dialog });
      await expect(dialog).toBeVisible();
      await settled(page, ".reply-sheet");
      // Stacked in the narrow sheet.
      const [first, second] = await dialog.locator(".reply-compare__column").all();
      expect((await second.boundingBox())!.y).toBeGreaterThan((await first.boundingBox())!.y + 20);
      await noPageOverflow(page);
      if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/blocks-mobile-${language}-${theme}.png` });
    });
  }
}

test("a follow-up chip is sent from the keyboard like typed context", async ({ page }) => {
  await open(page, "es", "light");
  const messages: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/talk")) messages.push(JSON.parse(request.postData() ?? "{}").message);
  });
  await send(page, "compara gatos y perros");
  const chip = page.getByRole("button", { name: "¿Cuál cuesta menos?" });
  await expect(chip).toBeVisible();
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => messages).toEqual(["compara gatos y perros", "¿Cuál cuesta menos?"]);
  await expect(page.locator(INPUT)).toBeFocused();
});

test("reduced motion shows the reply without entrance animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "es", "light");
  await send(page, "compara gatos y perros");
  const word = page.locator(".reply-card .reply-word").first();
  await expect(word).toBeVisible();
  expect(await word.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.locator(".reply-card").evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("a failed reply shows the localized notice and no card", async ({ page }) => {
  await open(page, "es", "light");
  await page.route("**/api/talk", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Speech unavailable"}' }));
  await send(page, "compara gatos y perros");
  await expect(page.getByText(labels.es.unavailable)).toBeVisible();
  await expect(page.locator(".reply-card")).toHaveCount(0);
});
