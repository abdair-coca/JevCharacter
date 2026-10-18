import { test as base, expect } from "@playwright/test";

// The API always answers 503, so specs never reach a provider and the app runs on its local instinct.
export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"unavailable":true}' }),
    );
    await use(page);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  },
});

export { expect };
