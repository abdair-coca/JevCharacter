import { expect, test } from "./fixtures";

test.use({ reducedMotion: "reduce" });

test("shows Capacidades as static steps when motion is reduced", async ({ page }) => {
  await page.goto("/features");
  await expect(page.locator(".showcase-static-steps").first()).toBeVisible({ timeout: 45_000 });
});
