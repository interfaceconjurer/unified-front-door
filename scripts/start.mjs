import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
const mode = process.argv[2];
try {
  if (!["web", "dev", "worker"].includes(mode)) throw new Error("Invalid process mode");
  if (process.versions.node !== "22.23.2") throw new Error("Use Node 22.23.2");
  const { validateRuntimeConfiguration } = require("../.worker/lib/server/configuration.js");
  validateRuntimeConfiguration();
  const args = mode === "worker" ? ["--conditions=react-server", ".worker/worker.js"] : ["scripts/web.mjs", ...(mode === "dev" ? ["--dev"] : []), ...process.argv.slice(3)];
  const child = spawn(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...(mode === "worker" ? {} : { NODE_ENV: mode === "dev" ? "development" : "production" }) } });
  let deadline;
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
    child.kill(signal);
    deadline ??= setTimeout(() => child.kill("SIGKILL"), 25000);
  });
  child.on("error", () => { console.error("Application process could not start."); process.exitCode = 1; });
  child.on("exit", (code, signal) => { clearTimeout(deadline); process.exitCode = code ?? (signal ? 1 : 0); });
} catch { console.error("Application startup refused. Use Node 22, build the application, and configure Basic Auth, APP_ORIGIN, and DATABASE_URL."); process.exitCode = 1; }
