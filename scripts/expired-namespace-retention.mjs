const GRACE_DAYS = 30;
const GRACE_HOURS = GRACE_DAYS * 24;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function parseCursor(value) {
  const match = CURSOR.exec(value ?? "");
  if (!match || Number.isNaN(Date.parse(match[1]))) throw new Error("--after must be a retention report cursor");
  return { expiry: match[1], namespaceId: match[2].toLowerCase() };
}

export function parseRetentionArgs(args) {
  const options = { apply: false, limit: DEFAULT_LIMIT, namespaceId: null, after: null, expectedTarget: null, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--limit") {
      const value = args[++index];
      if (!/^[1-9]\d*$/.test(value ?? "") || Number(value) > MAX_LIMIT) throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}`);
      options.limit = Number(value);
    } else if (arg === "--namespace") {
      const value = args[++index];
      if (!UUID.test(value ?? "")) throw new Error("--namespace must be a UUID");
      options.namespaceId = value.toLowerCase();
    } else if (arg === "--after") {
      options.after = parseCursor(args[++index]);
    } else if (arg === "--expect-target") {
      const value = args[++index];
      if (!value || value.length > 255 || /\s/.test(value)) throw new Error("--expect-target must match the dry-run targetKey");
      options.expectedTarget = value;
    } else throw new Error("Unknown retention option");
  }
  if (options.namespaceId && options.after) throw new Error("--after cannot be combined with --namespace");
  if (options.apply && !options.expectedTarget) throw new Error("--apply requires --expect-target from a dry run");
  return options;
}

const count = row => Number(row.count);

async function lockedCandidate(client, namespaceId, cutoff, apply) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL search_path=public");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='5s'");
    const namespace = await client.query("SELECT id FROM demo_namespaces WHERE id=$1 FOR UPDATE SKIP LOCKED", [namespaceId]);
    if (!namespace.rowCount) return await finish(client, "locked_or_missing");

    // The namespace lock prevents new sessions from gaining an FK key-share lock.
    // Count first, then prove SKIP LOCKED acquired every existing session.
    const sessionCount = count((await client.query("SELECT count(*) AS count FROM demo_sessions WHERE namespace_id=$1", [namespaceId])).rows[0]);
    const sessions = (await client.query("SELECT id,expires_at FROM demo_sessions WHERE namespace_id=$1 ORDER BY id FOR UPDATE SKIP LOCKED", [namespaceId])).rows;
    if (!sessionCount) return await finish(client, "no_sessions");
    if (sessions.length !== sessionCount) return await finish(client, "session_locked");
    // The driver truncates timestamptz to milliseconds. Make the final age
    // decision in PostgreSQL at its full microsecond precision under the locks.
    const expiry = (await client.query(`SELECT max(expires_at) AS latest_expiry,
      bool_and(expires_at<=$2::timestamptz) AS eligible
      FROM demo_sessions WHERE namespace_id=$1`, [namespaceId, cutoff])).rows[0];
    const latestExpiry = expiry.latest_expiry;
    if (!expiry.eligible) return await finish(client, "too_recent", { latestExpiry });

    // Session then run follows worker ownership order. Lock all runs as well as
    // sessions so a direct/in-flight lease update cannot race the final check.
    const runCount = count((await client.query("SELECT count(*) AS count FROM agent_runs WHERE namespace_id=$1", [namespaceId])).rows[0]);
    const runs = (await client.query("SELECT id,lease_until FROM agent_runs WHERE namespace_id=$1 ORDER BY id FOR UPDATE SKIP LOCKED", [namespaceId])).rows;
    if (runs.length !== runCount) return await finish(client, "run_locked", { latestExpiry });
    const liveLease = (await client.query("SELECT EXISTS(SELECT 1 FROM agent_runs WHERE namespace_id=$1 AND lease_until>clock_timestamp()) AS active", [namespaceId])).rows[0].active;
    if (liveLease) return await finish(client, "live_lease", { latestExpiry });

    const sessionIds = sessions.map(row => row.id), runIds = runs.map(row => row.id);
    // Attempts can be cascaded away by a workspace reset while reserved budget
    // rows intentionally survive. Match stored keys by exact namespace suffix,
    // accepting only the two internal scope forms reserveModelCalls can create.
    const budgetKeys = (await client.query(`SELECT DISTINCT scope FROM model_call_budgets
      WHERE scope=$1 OR scope ~ $2`, [
      `application:namespace:${namespaceId}`,
      `^test:[a-f0-9-]{36}:namespace:${namespaceId}$`,
    ])).rows.map(row => row.scope);
    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM workspaces WHERE namespace_id=$1) AS workspaces,
      (SELECT count(*)::int FROM agent_conversations WHERE namespace_id=$1) AS conversations,
      (SELECT count(*)::int FROM improvement_projects WHERE namespace_id=$1) AS projects,
      (SELECT count(*)::int FROM project_drafts WHERE namespace_id=$1) AS project_drafts,
      (SELECT count(*)::int FROM canvas_drafts WHERE namespace_id=$1) AS canvas_drafts,
      (SELECT count(*)::int FROM session_receipts WHERE session_id=ANY($2::uuid[])) AS session_receipts,
      (SELECT count(*)::int FROM model_dispatch_slots WHERE run_id=ANY($3::uuid[])) AS dispatch_slots,
      (SELECT count(*)::int FROM model_call_budgets WHERE scope=ANY($4::text[])) AS namespace_budgets`,
    [namespaceId, sessionIds, runIds, budgetKeys])).rows[0];
    const record = { namespaceId, latestExpiry: latestExpiry.toISOString(), sessions: sessionCount, runs: runCount, ...counts };
    if (!apply) return await finish(client, "eligible", record);

    await client.query("DELETE FROM model_dispatch_slots WHERE run_id=ANY($1::uuid[])", [runIds]);
    await client.query("DELETE FROM model_call_budgets WHERE scope=ANY($1::text[])", [budgetKeys]);
    await client.query("DELETE FROM session_receipts WHERE session_id=ANY($1::uuid[])", [sessionIds]);
    await client.query("DELETE FROM demo_sessions WHERE namespace_id=$1", [namespaceId]);
    await client.query("DELETE FROM workspaces WHERE namespace_id=$1", [namespaceId]);
    const deleted = await client.query("DELETE FROM demo_namespaces WHERE id=$1", [namespaceId]);
    if (deleted.rowCount !== 1) throw new Error("Namespace deletion was not confirmed");
    await client.query("COMMIT");
    return { outcome: "deleted", ...record };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function finish(client, outcome, details = {}) {
  await client.query("ROLLBACK");
  return { outcome, ...details };
}

export async function pruneExpiredNamespaces(client, options = {}, onProgress = () => {}) {
  const { apply = false, limit = DEFAULT_LIMIT, namespaceId = null, after = null } = options;
  if (typeof apply !== "boolean" || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT || (namespaceId !== null && !UUID.test(namespaceId))
    || (after !== null && (!after.expiry || !CURSOR.test(`${after.expiry}@${after.namespaceId}`))) || (namespaceId && after)) throw new Error("Invalid retention options");
  // Preserve microseconds when the one DB-clock cutoff travels back through pg.
  // Hours are elapsed time even when a database session timezone observes DST.
  const cutoff = (await client.query(`SELECT to_char((clock_timestamp()-interval '${GRACE_HOURS} hours') AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cutoff`)).rows[0].cutoff;
  const scanLimit = namespaceId ? 1 : Math.min(MAX_LIMIT * 4, limit * 4);
  const candidates = namespaceId
    ? (await client.query("SELECT namespace_id,max(expires_at) AS latest_expiry FROM demo_sessions WHERE namespace_id=$1 GROUP BY namespace_id", [namespaceId])).rows
    : (await client.query(`SELECT s.namespace_id,max(s.expires_at) AS latest_expiry,
          to_char(max(s.expires_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_expiry
        FROM demo_sessions s
        WHERE s.expires_at<=$1::timestamptz AND NOT EXISTS (
          SELECT 1 FROM demo_sessions newer WHERE newer.namespace_id=s.namespace_id AND newer.expires_at>$1::timestamptz
        )
        GROUP BY s.namespace_id
        HAVING $3::timestamptz IS NULL OR (max(s.expires_at),s.namespace_id)>($3::timestamptz,$4::uuid)
        ORDER BY latest_expiry,s.namespace_id LIMIT $2`, [cutoff, scanLimit + 1, after?.expiry ?? null, after?.namespaceId ?? null])).rows;
  const report = {
    event: "demo.retention", mode: apply ? "apply" : "dry-run", graceDays: GRACE_DAYS,
    cutoff, limit, scanLimit, namespaceId, after: after ? `${after.expiry}@${after.namespaceId}` : null,
    candidates: candidates.length, scanned: 0, blocked: 0, eligible: 0, deleted: 0,
    scanCapped: !namespaceId && candidates.length > scanLimit, limitReached: false, hasMore: false, nextCursor: null,
    namespaces: [],
  };
  for (const candidate of candidates.slice(0, scanLimit)) {
    if (report.eligible === limit) { report.limitReached = true; break; }
    const result = await lockedCandidate(client, candidate.namespace_id, cutoff, apply);
    report.scanned++;
    if (result.outcome === "eligible" || result.outcome === "deleted") report.eligible++;
    else report.blocked++;
    if (result.outcome === "deleted") report.deleted++;
    const latestExpiry = result.latestExpiry ?? candidate.latest_expiry;
    const entry = { namespaceId: candidate.namespace_id, ...result,
      latestExpiry: latestExpiry instanceof Date ? latestExpiry.toISOString() : latestExpiry,
      ageDaysApprox: Math.floor((new Date(cutoff).getTime() - new Date(latestExpiry).getTime()) / 86400000) + GRACE_DAYS };
    report.namespaces.push(entry);
    if (!namespaceId) report.nextCursor = `${candidate.cursor_expiry}@${candidate.namespace_id}`;
    await onProgress({ event: "demo.retention.namespace", mode: report.mode, ...entry, nextCursor: report.nextCursor });
  }
  if (report.eligible === limit && report.scanned < Math.min(candidates.length, scanLimit)) report.limitReached = true;
  report.hasMore = !namespaceId && candidates.length > report.scanned;
  return report;
}
