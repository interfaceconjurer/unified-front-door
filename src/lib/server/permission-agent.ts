import "server-only";
import type { PoolClient } from "pg";
import type { CapturedContext } from "../agent/contracts";
import { hasExplicitNavigationIntent } from "../agent/navigation-intent";
import { permissionReply } from "../agent/permission-actions";
import { conflict, parseCommand, stableJson } from "../application/contracts";
import { canvasId, canvasTarget } from "../surface-canvas/model";
import { canvasCommand } from "./canvas-commands";
import type { OwnedSession } from "./session";

/** Local demo edits and their conversation receipt commit in one transaction.
 * No external side effect or uncertain worker dispatch is involved. */
export async function applyPermissionReply(client: PoolClient, session: OwnedSession, context: CapturedContext, text: string, requestId: string) {
  const canvas = context.canvas;
  if (!canvas || !context.permissions || hasExplicitNavigationIntent(text)
    || !/\b(permission|permissions|access|delete|deletion|cases|remaining|everyone|users|undo|same)\b/i.test(text)) return null;
  const id = canvasId(canvas.kind, canvas.params), scope = [session.namespaceId, session.profileId];
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [stableJson([...scope, `canvas:${id}`])]);
  const row = (await client.query("SELECT fields,revision FROM canvas_drafts WHERE namespace_id=$1 AND profile_id=$2 AND id=$3 FOR UPDATE", [...scope, id])).rows[0];
  const reply = permissionReply(text, row?.fields ?? {});
  const changed = !!reply.patch && Object.keys(reply.patch).length > 0;
  if (changed) {
    if (context.canvasRevision !== (row?.revision ?? 0)) conflict("The permissions changed since this message was prepared. Review the current access and send the request again.");
    const command = parseCommand({ kind: "canvas.save", commandId: requestId, expectedRevision: row?.revision ?? 0,
      canvas, surface: "build", target: canvasTarget(canvas, context.target), fields: reply.patch });
    if (command.kind !== "canvas.save") throw new Error("Invalid permission command");
    await canvasCommand(client, session, command);
  }
  return { text: reply.text, changed, patch: reply.patch };
}
