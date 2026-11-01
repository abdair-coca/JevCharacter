import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const INPUT = "#creature-context";
const SPOKEN = "¡Hola! Te cuento varias opciones.";
const talkDecision = {
  action: { kind: "talk", state: "talkb" },
  actionConfidence: 0.9, reaction: "BASE", reactionConfidence: 0.9,
  probabilities: { BASE: 0.8, HELLO: 0.1, GHOST: 0.05, FLOWER: 0.05, QUESTION: 0 },
  intensity: 0.4, wantsAttention: 0.3, source: "jev",
};

/** Jev talks on every message; `/api/speak` answers with a quarter second of PCM. Returns what it received. */
async function mockVoice(page: Page, googleKey: string | null) {
  const speak: { body: unknown; key: string | undefined }[] = [];
  await page.addInitScript((key) => {
    if (key) window.localStorage.setItem("jevling.geminiKey", JSON.stringify(key));
  }, googleKey);
  await page.route("**/api/decide", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(talkDecision) }));
  await page.route("**/api/talk", route => route.fulfill({
    status: 200, contentType: "text/event-stream",
    body: `event: spoken\ndata: ${JSON.stringify({ text: SPOKEN })}\n\nevent: done\ndata: {}\n\n`,
  }));
  await page.route("**/api/speak", route => {
    speak.push({ body: route.request().postDataJSON(), key: route.request().headers()["x-gemini-api-key"] });
    return route.fulfill({ status: 200, contentType: "audio/L16;rate=24000;channels=1", body: Buffer.alloc(12_000) });
  });
  return speak;
}

async function say(page: Page, text: string) {
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
  await expect(page.locator(".speech-caption")).toContainText(SPOKEN);
}

test("with a Google key, Jev's sentence is spoken through /api/speak in the interface language", async ({ page }) => {
  const speak = await mockVoice(page, "AIza_test_visible_key_1234567890");
  await page.goto("/");
  await say(page, "hola Jev");
  await expect.poll(() => speak.length).toBe(1);
  expect(speak[0]).toEqual({ body: { text: SPOKEN, language: "es" }, key: "AIza_test_visible_key_1234567890" });
});

test("without a Google key, Jev chirps and never calls /api/speak", async ({ page }) => {
  const speak = await mockVoice(page, null);
  await page.goto("/");
  await say(page, "hola Jev");
  await page.waitForTimeout(1_500);
  expect(speak).toEqual([]);
});
