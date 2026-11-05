const { spawn } = require("node:child_process");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--hostname", "0.0.0.0"],
  {
    stdio: "inherit",
    env: process.env,
    shell: true,
  }
);

child.on("exit", (code, signal) => {
  console.log(`Next.js dev server exited with code ${code} / signal ${signal}`);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
