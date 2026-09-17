import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ApplicationError, conflict, exact, invalid, profileId, stableJson, text, type SessionView } from "../application/contracts";
import { INITIAL } from "../assessment/state-codec";
import { assessmentCursor } from "../assessment/cursor";
import { cancelSessionRuns } from "./agent-runs";

export const SESSION_COOKIE = "ufd_session";
export type OwnedSession = SessionView & { id: string };
export function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export async function findSession(client: PoolClient, token: string | undefined, lock: "share" | "update" | "none" = "none"): Promise<OwnedSession | null> {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
  const row = (await client.query(`SELECT s.id, s.namespace_id, s.profile_id, s.generation, s.expires_at, w.epoch FROM demo_sessions s LEFT JOIN workspaces w ON w.namespace_id=s.namespace_id AND w.profile_id=s.profile_id WHERE s.token_hash=$1 AND s.revoked=false AND s.expires_at>now()${lock === "none" ? "" : lock === "share" ? " FOR SHARE OF s" : " FOR UPDATE OF s"}`, [hash(token)])).rows[0];
  return row ? { id: row.id, namespaceId: row.namespace_id, profileId: row.profile_id, generation: row.generation, expiresAt: row.expires_at.toISOString(), ...(row.epoch ? { workspaceEpoch: row.epoch } : {}) } : null;
}
export function sessionView(session: OwnedSession): SessionView {
  return { namespaceId: session.namespaceId, profileId: session.profileId, generation: session.generation, expiresAt: session.expiresAt, ...(session.workspaceEpoch ? { workspaceEpoch: session.workspaceEpoch } : {}) };
}
export async function requireSession(client: PoolClient, token: string | undefined, generation: string, lock: "share" | "update" = "share"): Promise<OwnedSession> {
  const session = await findSession(client, token, lock);
  if (!session) throw new ApplicationError("unauthorized", "Your demo session expired. Reconnect to continue.", 401);
  if (session.generation !== generation) throw new ApplicationError("session_changed", "This demo session changed. Pending edits remain in their original workspace.", 409);
  if (!session.profileId) throw new ApplicationError("unauthorized", "Choose a demo profile first.", 401);
  return session;
}
export async function seedWorkspace(client: PoolClient, namespaceId: string, profile: string): Promise<void> {
  await client.query("INSERT INTO workspaces(namespace_id,profile_id,assessment_cursor) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [namespaceId, profile, assessmentCursor(INITIAL)]);
}
export async function bootstrap(client: PoolClient, token?: string): Promise<{ session: SessionView; token?: string }> {
  const existing = await findSession(client, token);
  if (existing) return { session: sessionView(existing) };
  const nextToken = randomBytes(32).toString("base64url"), namespaceId = randomUUID(), id = randomUUID(), generation = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await client.query("INSERT INTO demo_namespaces(id) VALUES($1)", [namespaceId]);
  await client.query("INSERT INTO demo_sessions(id,namespace_id,token_hash,generation,expires_at) VALUES($1,$2,$3,$4,$5)", [id, namespaceId, hash(nextToken), generation, expiresAt]);
  return { session: { namespaceId, profileId: null, generation, expiresAt }, token: nextToken };
}
export async function changeSession(client: PoolClient, token: string | undefined, input: unknown): Promise<SessionView> {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid();
  const command = input as Record<string, unknown>;
  exact(command, ["action", "commandId", "generation", "profileId"]);
  if (!text(command.commandId, 200) || !text(command.generation) || !["select", "signout", "reset", "reset-profile"].includes(command.action as string)
    || (command.action === "select" || command.action === "reset-profile" ? !profileId(command.profileId) : command.profileId !== undefined)) invalid();
  const session = await findSession(client, token, "update");
  if (!session) throw new ApplicationError("unauthorized", "Your demo session expired. Reconnect to continue.", 401);
  const digest = hash(stableJson(command));
  const receipt = (await client.query("SELECT payload_hash,result FROM session_receipts WHERE session_id=$1 AND command_id=$2", [session.id, command.commandId])).rows[0];
  if (receipt) { if (receipt.payload_hash !== digest) conflict("This command ID was already used for different input."); return sessionView(session); }
  if (session.generation !== command.generation) throw new ApplicationError("session_changed", "The demo session changed. Reconnect before continuing.", 409);
  const resetProfile = command.action === "reset-profile" ? command.profileId as NonNullable<SessionView["profileId"]> : session.profileId;
  const changesCurrentSession = command.action !== "reset-profile" || resetProfile === session.profileId;
  if (changesCurrentSession) await cancelSessionRuns(client, session);
  if (command.action === "reset" || command.action === "reset-profile") {
    if (!resetProfile) invalid("Choose a profile before resetting its demo workspace.");
    // Every cascading delete is rooted in this authenticated namespace AND persona.
    await client.query("DELETE FROM workspaces WHERE namespace_id=$1 AND profile_id=$2", [session.namespaceId, resetProfile]);
    await seedWorkspace(client, session.namespaceId, resetProfile);
  }
  // Public bootstrap creates one session per namespace. Its update lock excludes
  // that namespace's commands/workers while a target workspace gets a new epoch.
  // Clearing another persona must not interrupt the currently selected one.
  const next = { ...session, profileId: command.action === "signout" ? null : command.action === "select" ? command.profileId as SessionView["profileId"] : session.profileId, generation: changesCurrentSession ? randomUUID() : session.generation };
  if (changesCurrentSession) {
    if (next.profileId) await seedWorkspace(client, next.namespaceId, next.profileId);
    next.workspaceEpoch = next.profileId ? (await client.query("SELECT epoch FROM workspaces WHERE namespace_id=$1 AND profile_id=$2", [next.namespaceId, next.profileId])).rows[0].epoch : undefined;
    await client.query("UPDATE demo_sessions SET profile_id=$2,generation=$3 WHERE id=$1", [session.id, next.profileId, next.generation]);
  }
  await client.query("INSERT INTO session_receipts(session_id,command_id,payload_hash,result) VALUES($1,$2,$3,$4)", [session.id, command.commandId, digest, sessionView(next)]);
  return sessionView(next);
}
