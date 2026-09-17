import { cookies } from "next/headers";
import { transaction } from "@/lib/db";
import { readImportedSource } from "@/lib/server/import";
import { requireSession, SESSION_COOKIE } from "@/lib/server/session";
import { PRIVATE_HEADERS, requireGeneration, responseError } from "@/lib/server/http";
import { withRequestDiagnostics } from "@/lib/server/diagnostics";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return withRequestDiagnostics("application.import-source", async () => {
    try {
      const query = new URL(request.url).searchParams;
      const generation = requireGeneration(query.get("generation")), sourceHash = query.get("sourceHash") ?? "";
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      const result = await transaction(async client => readImportedSource(client, await requireSession(client, token, generation), sourceHash));
      return Response.json(result, { headers: { ...PRIVATE_HEADERS, "Content-Disposition": 'attachment; filename="imported-workspace-source.json"' } });
    } catch (error) { return responseError(error); }
  });
}
