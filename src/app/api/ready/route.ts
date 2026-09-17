import { assertReadiness } from "@/lib/server/readiness";
import { diagnoseError, withRequestDiagnostics } from "@/lib/server/diagnostics";
import { PRIVATE_HEADERS } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return withRequestDiagnostics("readiness", async () => {
    try { await assertReadiness(); return Response.json({ ready: true }, { headers: PRIVATE_HEADERS }); }
    catch (error) { diagnoseError(error); return Response.json({ ready: false }, { status: 503, headers: PRIVATE_HEADERS }); }
  });
}
