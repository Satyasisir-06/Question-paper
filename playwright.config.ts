import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath)
  ? chromePath
  : fs.existsSync(edgePath)
    ? edgePath
    : undefined;

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3099",
    headless: true,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: "npm run start -- -p 3099 -H 127.0.0.1",
    url: "http://127.0.0.1:3099",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL: "pglite://./data/pgdata",
      STORAGE_PROVIDER: "local",
      LOCAL_STORAGE_DIR: "./storage",
      SESSION_SECRET: "playwright-e2e-session-secret-longer-than-32-chars-012345",
    },
  },
});
