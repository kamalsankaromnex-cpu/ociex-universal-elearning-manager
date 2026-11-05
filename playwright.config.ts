import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Load .env variables so workers inherit them
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

// Fallback defaults if missing
process.env.ADMIN_EMAIL ||= "admin@example.com";
process.env.ADMIN_PASSWORD ||= "choose-a-strong-password-at-least-12-characters";
const port = process.env.PORT || "3100";
process.env.APP_ORIGIN ||= `http://localhost:${port}`;

const candidateBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean) as string[];

const resolvedExecutable = candidateBrowsers.find((p) => existsSync(p));

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    launchOptions: {
      executablePath: resolvedExecutable,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: {
    command: `npx next dev -p ${port} --hostname 0.0.0.0`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
