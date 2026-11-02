import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Phones load every view and measure the story; interaction in depth stays on the desktop project.
const PHONE_SPECS = /(routes|navigation|reduced-motion|story-performance)\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // First visits follow the browser language; pin Spanish so label selectors stay stable.
    locale: "es-ES",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "android", use: { ...devices["Pixel 7"] }, testMatch: PHONE_SPECS },
    { name: "iphone", use: { ...devices["iPhone 14"] }, testMatch: PHONE_SPECS },
  ],
  // vite preview serves the build without the dev API middleware, so specs never reach a provider.
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // The build talks to a fake Supabase project that account.spec.ts answers; never to the real one.
    env: { VITE_SUPABASE_URL: "https://jev-e2e.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e" },
  },
});
