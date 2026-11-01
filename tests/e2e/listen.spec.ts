import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { encodeWav } from "../../src/creature/listen/wav";
import { expect, test } from "./fixtures";

const RATE = 16_000;
const MIC = "button[aria-label='Manos libres']";

// The fake microphone loops this file: a second of silence, a voiced phrase, then silence that closes it.
function phraseWav() {
  const audio = new Float32Array(RATE * 4);
  for (let index = RATE; index < RATE * 2.2; index++) {
    const time = index / RATE;
    const syllables = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * time);
    audio[index] = 0.35 * syllables * (Math.sin(2 * Math.PI * 180 * time) + 0.6 * Math.sin(2 * Math.PI * 720 * time) + 0.3 * Math.sin(2 * Math.PI * 1500 * time)) / 1.9;
  }
  const directory = join(tmpdir(), "jevling-e2e");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "phrase.wav");
  writeFileSync(path, encodeWav(audio, RATE));
  return path;
}

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${phraseWav()}`] },
});
test.skip(({ browserName }) => browserName !== "chromium", "The fake microphone file is a Chromium flag.");

/** Every heard phrase transcribes to the next text (then to silence); returns what each API received. */
async function mockConversation(page: Page, ...texts: string[]) {
  const calls = { transcribe: [] as { language: string }[], talk: [] as { message: string }[], decide: [] as string[] };
  await page.addInitScript(() => window.localStorage.setItem("jevling.groqKey", JSON.stringify("gsk_test_visible_key_1234567890")));
  await page.route("**/api/transcribe", route => {
    calls.transcribe.push(route.request().postDataJSON() as { language: string });
    const text = texts[calls.transcribe.length - 1] ?? "";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text }) });
  });
  await page.route("**/api/decide", route => {
    calls.decide.push(route.request().postData() ?? "");
    return route.fulfill({ status: 503, contentType: "application/json", body: '{"unavailable":true}' });
  });
  await page.route("**/api/talk", route => {
    calls.talk.push(route.request().postDataJSON() as { message: string });
    const body = `event: spoken\ndata: ${JSON.stringify({ text: "Te cuento varias opciones." })}\n\nevent: done\ndata: {}\n\n`;
    return route.fulfill({ status: 200, contentType: "text/event-stream", body });
  });
  return calls;
}

test("a phrase said to Jev by name gets a spoken reply without typing or a decision", async ({ page }) => {
  const calls = await mockConversation(page, "Jev, ¿qué carreras puedo estudiar?");
  await page.goto("/");
  const mic = page.locator(MIC);
  await expect(mic).toBeVisible({ timeout: 45_000 });

  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".whisper__listen")).toBeVisible();

  await expect.poll(() => calls.talk.length, { timeout: 20_000 }).toBe(1);
  expect(calls.talk[0].message).toBe("¿qué carreras puedo estudiar?");
  expect(calls.transcribe[0].language).toBe("es");
  // Jev may still decide on his own (returning after an absence), never on what was said to him.
  expect(calls.decide.filter(body => body.includes("carreras"))).toEqual([]);
  await expect(page.locator(".speech-caption")).toContainText("Te cuento varias opciones.");
  await expect(page.locator(".whisper__listen q")).toHaveText("¿qué carreras puedo estudiar?");

  // Switching off releases the microphone; nothing more is sent.
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  const heard = calls.transcribe.length;
  await page.waitForTimeout(4_500);
  expect(calls.transcribe.length).toBe(heard);
});

test("phrases that do not name Jev get no reply", async ({ page }) => {
  const calls = await mockConversation(page, "y entonces le dije a mi hermana", "mañana hay examen");
  await page.goto("/");
  const mic = page.locator(MIC);
  await expect(mic).toBeVisible({ timeout: 45_000 });

  await mic.click();
  await expect.poll(() => calls.transcribe.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  expect(calls.talk).toEqual([]);
  expect(calls.decide.filter(body => body.includes("hermana") || body.includes("examen"))).toEqual([]);
  await expect(page.locator(".whisper__listen")).not.toContainText("Oí");
});
