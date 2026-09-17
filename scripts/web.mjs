import { createServer } from "node:http";
import next from "next";
import auth from "../src/lib/server/http-auth.js";

// Authenticate the original HTTP request before Next can clone its body. A
// denied Proxy POST in Next 16.3.5 leaves an unread reconstructed request whose
// socket close can emit an unhandled ECONNRESET. This uses only Next's public API.
const args = process.argv.slice(2), dev = args.includes("--dev");
function option(name, fallback) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
const port = Number(option("--port", process.env.PORT ?? "3000")), hostname = option("--hostname", "0.0.0.0");
if (process.versions.node !== "22.23.2" || !Number.isInteger(port) || port < 1 || port > 65535 || !hostname) throw new Error("Use Node 22.23.2 and a valid HTTP listener configuration.");
const server = createServer({ headersTimeout: 10000, requestTimeout: 15000, keepAliveTimeout: 5000, connectionsCheckingInterval: 1000,
  // Next installs its own HMR upgrade listener after the first handled request.
  // Node must reject unauthenticated upgrades before *any* listener sees them.
  shouldUpgradeCallback: request => {
    const allowed = dev && request.url?.split("?")[0] === "/_next/hmr" && gate(request) === null && server.listenerCount("upgrade") > 0;
    if (allowed) { upgrades.add(request.socket); request.socket.once("close", () => upgrades.delete(request.socket)); }
    return allowed;
  } });
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler(), sockets = new Set(), upgrades = new Set();
const headers = { "Cache-Control": "private, no-store, max-age=0", Connection: "close" };
function gate(request) {
  let configured;
  try { configured = auth.authConfiguration(process.env); } catch { return { status: 503, body: "Site unavailable.", headers }; }
  if (auth.authorized(request.headers.authorization, configured)) return null;
  return { status: 401, body: "Authentication required.", headers: { ...headers, "WWW-Authenticate": 'Basic realm="Unified Front Door prototype", charset="UTF-8"' } };
}
function failure(category) { console.error(JSON.stringify({ at: new Date().toISOString(), event: "http.transport", category })); }
server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
server.on("request", (request, response) => {
  request.on("error", error => failure(error.code === "ECONNRESET" ? "request_reset" : error.code === "ABORT_ERR" ? "request_cancelled" : "request_failed"));
  const denied = gate(request);
  if (denied) { request.resume(); response.writeHead(denied.status, denied.headers); response.end(denied.body); return; }
  if (request.headers.upgrade) { request.resume(); response.writeHead(426, headers); response.end("HTTP upgrade unavailable."); return; }
  void handle(request, response).catch(() => {
    failure("handler_failed");
    if (!response.headersSent) { response.writeHead(500, { "Cache-Control": "no-store" }); response.end("Request unavailable."); }
    else response.destroy();
  });
});
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  const deadline = setTimeout(() => { failure("shutdown_timeout"); for (const socket of sockets) socket.destroy(); process.exit(1); }, 20000);
  // server.close() drains HTTP but excludes upgraded connections. HMR carries
  // no application writes, so close its sockets explicitly during shutdown.
  for (const socket of upgrades) socket.destroySoon();
  try {
    await new Promise(resolve => server.close(resolve));
    await app.close();
    clearTimeout(deadline);
    console.info(JSON.stringify({ at: new Date().toISOString(), event: "web.lifecycle", outcome: "stopped" }));
    // Next development can retain bundler handles after its public close()
    // resolves. Like Next's CLI, exit only after HTTP drain and cleanup finish.
    process.exit(0);
  } catch { failure("shutdown_failed"); process.exit(1); }
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { void stop(); });
await app.prepare();
if (stopping) await app.close();
else {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, hostname, resolve); });
  console.info(JSON.stringify({ at: new Date().toISOString(), event: "web.lifecycle", outcome: "started", mode: dev ? "development" : "production" }));
}
