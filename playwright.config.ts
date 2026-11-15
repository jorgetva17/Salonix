import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

loadEnvConfig(process.cwd());

const chromium = "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/manifest.webmanifest", reuseExistingServer: true, timeout: 120_000 },
});
