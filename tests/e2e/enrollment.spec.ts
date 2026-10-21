import type { Page } from "@playwright/test";
import { characterAspectsDuring, expect, test } from "./fixtures";

const INPUT = "#creature-context";

async function send(page: Page, text: string) {
  await page.locator(INPUT).fill(text);
  await page.locator(INPUT).press("Enter");
}

async function fillValidData(page: Page) {
  await page.locator("#enrollment-name").fill("María José Quispe Mamani");
  await page.locator("#enrollment-phone").fill("71234567");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(INPUT)).toBeVisible({ timeout: 45_000 });
});

test("opens the demo form for an enrollment intent", async ({ page }) => {
  await send(page, "quiero inscribirme");

  await expect(page.locator("#enrollment-name")).toBeVisible();
  await expect(page.locator("#enrollment-phone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar datos" })).toBeVisible();
});

test("does not open the form for a negated intent", async ({ page }) => {
  await send(page, "no quiero inscribirme");

  await expect(page.locator("#enrollment-name")).toHaveCount(0);
});

test("asks for corrections before confirming with valid data", async ({ page }) => {
  await send(page, "quiero inscribirme");
  await page.getByRole("button", { name: "Confirmar datos" }).click();

  await expect(page.locator("#enrollment-name")).toBeVisible();
  await expect(page.getByText("Datos completados")).toHaveCount(0);

  await fillValidData(page);
  await page.getByRole("button", { name: "Confirmar datos" }).click();
  await expect(page.getByText("Datos completados")).toBeVisible();
});

test("closes back to Jev and starts empty the next time", async ({ page }) => {
  await send(page, "quiero inscribirme");
  await fillValidData(page);
  await page.getByRole("button", { name: "Confirmar datos" }).click();
  await expect(page.getByText("Datos completados")).toBeVisible();

  await page.getByRole("button", { name: "Volver a Jev" }).click();
  await expect(page.locator(INPUT)).toBeVisible();
  await expect(page.locator("#enrollment-name")).toHaveCount(0, { timeout: 15_000 });

  await send(page, "quiero inscribirme");
  await expect(page.locator("#enrollment-name")).toHaveValue("");
});

test("Jev keeps her round shape while the form opens and closes", async ({ page }) => {
  const opening = await characterAspectsDuring(page, () => send(page, "quiero inscribirme"));
  await expect(page.locator("#enrollment-name")).toBeVisible();
  const closing = await characterAspectsDuring(page, () => page.locator(".enrollment__close").click());
  await expect(page.locator("#enrollment-name")).toHaveCount(0, { timeout: 15_000 });
  expect(closing.length).toBeGreaterThan(10);
  for (const aspect of [...opening, ...closing]) expect(aspect).toBeCloseTo(1, 1);
});
