import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3014",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.E2E_PRODUCTION
      ? "npm start -- --port 3014"
      : "npm run dev -- --port 3014",
    url: "http://127.0.0.1:3014",
    reuseExistingServer: false,
    timeout: 60000,
    env: { DATABASE_PATH: `./work/e2e-${Date.now()}.sqlite` },
  },
});
