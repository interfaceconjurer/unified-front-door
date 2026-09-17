import { correlateCommand, withRequestDiagnostics } from "@/lib/server/diagnostics";
import { cookies } from "next/headers";
import { transaction } from "@/lib/db";
import { executeCommand } from "@/lib/server/application";
import { readApplicationSnapshot } from "@/lib/server/snapshots";
import { requireSession, SESSION_COOKIE } from "@/lib/server/session";
import { assertSameOrigin, PRIVATE_HEADERS, requestObject, requireGeneration, responseError } from "@/lib/server/http";
import { exact, invalid, parseCommand } from "@/lib/application/contracts";
import { importPreview } from "@/lib/server/import";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRequestDiagnostics("application.read", async () => {
    try {
      const token = (await cookies()).get(SESSION_COOKIE)?.value, generation = requireGeneration(new URL(request.url).searchParams.get("generation"));
      const snapshot = await readApplicationSnapshot(token, generation);
      return Response.json(snapshot, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
export async function POST(request: Request) {
  return withRequestDiagnostics("application.write", async () => {
    try {
      assertSameOrigin(request); const body = await requestObject(request); exact(body, ["generation", "command", "preview"]);
      correlateCommand(typeof body.command === "object" && body.command ? (body.command as Record<string, unknown>).commandId : undefined);
      if (body.preview !== undefined && typeof body.preview !== "boolean") invalid();
      const generation = requireGeneration(body.generation), token = (await cookies()).get(SESSION_COOKIE)?.value;
      if (body.preview === true) {
        const command = parseCommand(body.command);
        if (command.kind !== "legacy.import") invalid();
        const summary = await transaction(async (client) => importPreview(await requireSession(client, token, generation), command.source));
        return Response.json({ summary }, { headers: PRIVATE_HEADERS });
      }
      const result = await transaction((client) => executeCommand(client, token, generation, body.command));
      return Response.json({ result }, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
