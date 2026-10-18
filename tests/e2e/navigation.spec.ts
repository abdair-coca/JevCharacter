import { expect, test } from "./fixtures";

test("keeps the chosen language after a direct navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#creature-context")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "English", exact: true }).click();

  await page.goto("/features");
  await expect(page.getByRole("button", { name: "View scene: Transforms" })).toBeVisible({ timeout: 45_000 });
});

test("keeps the sound toggle state after a reload", async ({ page }) => {
  await page.goto("/");
  const sound = page.getByRole("button", { name: "Sonido de Jev" });
  await expect(sound).toBeVisible({ timeout: 45_000 });
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(page.getByRole("button", { name: "Sonido de Jev" })).toHaveAttribute("aria-pressed", "false");
});
