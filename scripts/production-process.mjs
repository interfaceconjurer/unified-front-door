import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
export async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve)); return port;
}
export function startProduction(port, env, logFile, raw = false) {
  return startWeb(port, env, logFile, raw, false);
}
export function startDevelopment(port, env, logFile) {
  return startWeb(port, env, logFile, false, true);
}
function startWeb(port, env, logFile, raw, dev) {
  const log = createWriteStream(logFile, { flags: "w", mode: 0o600 });
  const args = raw ? ["scripts/web.mjs"] : ["--conditions=react-server", "scripts/start.mjs", dev ? "dev" : "web"];
  const child = spawn(process.execPath, [...args, "--hostname", "127.0.0.1", "--port", String(port)], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const exited = new Promise(resolve => child.once("exit", (code, signal) => { log.end(); resolve({ code, signal }); }));
  child.once("error", () => { log.end(); });
  return { child, exited, async stop() {
    if (child.exitCode !== null || child.signalCode) return;
    try { process.kill(-child.pid, "SIGTERM"); } catch { return; }
    const timer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* The child may already have exited. */ } }, 10000);
    await exited; clearTimeout(timer);
  } };
}
export async function waitForServer(origin, processHandle, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (processHandle.child.exitCode !== null || processHandle.child.signalCode) throw new Error("Production server exited before accepting requests.");
    try { const result = await fetch(origin + "/api/ready", { signal: AbortSignal.timeout(1000) }); if ([200, 401, 503].includes(result.status)) return; } catch { /* Startup has not opened the listener yet. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Production server startup timed out.");
}
