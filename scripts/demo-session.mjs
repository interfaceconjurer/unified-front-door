import { readFile, lstat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { writePrivateSession } from "./private-session-file.mjs";

// Uses the running app's session/seed/reset service, never a second SQL mutation path.
const action = process.argv[2], args = process.argv.slice(3);
const options = new Map();
let jar, sessionFile;
try {
  if (!["seed", "reset"].includes(action)) throw new Error("Invalid action");
  for(let index=0;index<args.length;index++) {
    const name=args[index]; if(options.has(name) || !["--session-file","--profile","--confirm-reset"].includes(name)) throw new Error("Invalid option");
    if(name==="--confirm-reset") options.set(name,true);
    else { const value=args[++index]; if(!value || value.startsWith("--"))throw new Error("Missing option value");options.set(name,value); }
  }
  sessionFile = options.get("--session-file");
  const profileId = options.get("--profile") ?? "sp";
  if (!isAbsolute(sessionFile ?? "") || !["jw", "kf", "am", "sp"].includes(profileId)) throw new Error("Specify an absolute private session file and a valid profile");
  if (action === "reset" && !options.has("--confirm-reset")) throw new Error("Reset requires --confirm-reset");
  const origin = new URL(process.env.APP_ORIGIN ?? "");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || !process.env.BASIC_AUTH_PASSWORD) throw new Error("Invalid app configuration");
  try {
    const info=await lstat(sessionFile);if(!info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Session file must be a private regular file");
    jar = JSON.parse(await readFile(sessionFile, "utf8"));
    if (jar.origin !== origin.origin || !/^[A-Za-z0-9_-]{43}$/.test(jar.token)) throw new Error("Session file belongs to another app");
  } catch (error) { if (error.code !== "ENOENT") throw error; if (action === "reset") throw new Error("Reset requires an existing session file"); jar = { origin: origin.origin }; }
  const persist = () => writePrivateSession(sessionFile, jar);
  async function request(path, body) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(path, origin), { method: body ? "POST" : "GET", signal: controller.signal,
        headers: { Authorization: `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USER || "guest"}:${process.env.BASIC_AUTH_PASSWORD}`).toString("base64")}`,
          ...(jar.token ? { Cookie: `ufd_session=${jar.token}` } : {}), ...(body ? { Origin: origin.origin, "x-ufd-mutation": "1", "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined });
      const token = response.headers.getSetCookie().map((value) => /^ufd_session=([^;]+)/.exec(value)?.[1]).find(Boolean);
      if (token) { jar.token = token; await persist(); }
      const result = await response.json(); if (!response.ok) throw new Error("Application request failed"); return result;
    } finally { clearTimeout(timeout); }
  }
  let { session } = await request("/api/session");
  if (!session) ({ session } = await request("/api/session", { action: "bootstrap" }));
  const recoveredReset = jar.pending?.action === "reset";
  if (jar.pending && (jar.pendingProfileId !== profileId || recoveredReset && action !== "reset")) throw new Error("Recover the previous command with the same profile and action first");
  if (jar.pending) { ({ session } = await request("/api/session", jar.pending)); delete jar.pending; await persist(); }
  if (session.profileId !== profileId) {
    jar.pendingProfileId = profileId; jar.pending = { action: "select", profileId, generation: session.generation, commandId: randomUUID() }; await persist();
    ({ session } = await request("/api/session", jar.pending)); delete jar.pending; await persist();
  }
  if (action === "reset" && !recoveredReset) {
    jar.pendingProfileId = profileId; jar.pending = { action: "reset", generation: session.generation, commandId: randomUUID() }; await persist();
    ({ session } = await request("/api/session", jar.pending)); delete jar.pending; await persist();
  }
  const snapshot = await request(`/api/application?generation=${encodeURIComponent(session.generation)}`);
  console.log(`${action === "reset" ? "Reset" : "Seeded"} demo namespace ${session.namespaceId}, profile ${profileId}. ${snapshot.assessment.projects.length} projects, ${snapshot.canvases.length} drafts. Session file is private.`);
} catch {
  console.error("Demo command was not confirmed. Check APP_ORIGIN/Basic Auth and the private --session-file. Reset also requires --confirm-reset. Rerun the same command/session file to recover an uncertain outcome.");
  process.exitCode = 1;
}
