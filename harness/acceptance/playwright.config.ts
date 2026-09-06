import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || "acceptance.json" }]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
