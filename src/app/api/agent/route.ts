import { correlateCommand, correlateRun, withRequestDiagnostics } from "@/lib/server/diagnostics";
import { cookies } from "next/headers";
import { transaction } from "@/lib/db";
import { executeAgentCommand } from "@/lib/server/agent";
import { readAgentSnapshot } from "@/lib/server/snapshots";
import { SESSION_COOKIE } from "@/lib/server/session";
import { assertSameOrigin, PRIVATE_HEADERS, requestObject, requireGeneration, responseError } from "@/lib/server/http";
import { exact } from "@/lib/application/contracts";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRequestDiagnostics("agent.read", async () => {
    try {
      const token = (await cookies()).get(SESSION_COOKIE)?.value, url = new URL(request.url), generation = requireGeneration(url.searchParams.get("generation")), runId = url.searchParams.get("runId");
      const snapshot = await readAgentSnapshot(token, generation, runId, Number(url.searchParams.get("after") ?? 0));
      return Response.json(snapshot, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
export async function POST(request: Request) {
  return withRequestDiagnostics("agent.write", async () => {
    try {
      assertSameOrigin(request); const body = await requestObject(request); exact(body, ["generation", "command"]);
      correlateCommand(typeof body.command === "object" && body.command ? (body.command as Record<string, unknown>).requestId : undefined);
      const generation = requireGeneration(body.generation), token = (await cookies()).get(SESSION_COOKIE)?.value;
      const result = await transaction(client => executeAgentCommand(client, token, generation, body.command));
      correlateRun(result.runId);
      return Response.json({ result }, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
