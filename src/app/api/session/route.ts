import { correlateCommand, withRequestDiagnostics } from "@/lib/server/diagnostics";
import { cookies } from "next/headers";
import { transaction } from "@/lib/db";
import { bootstrap, changeSession, findSession, sessionView, SESSION_COOKIE } from "@/lib/server/session";
import { assertSameOrigin, PRIVATE_HEADERS, requestObject, responseError } from "@/lib/server/http";
import { exact, invalid } from "@/lib/application/contracts";
import { applicationOrigin } from "@/lib/server/configuration";
export const runtime = "nodejs";
export async function GET() {
  return withRequestDiagnostics("session.read", async () => {
    try {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      const session = await transaction((client) => findSession(client, token));
      return Response.json({ session: session ? sessionView(session) : null }, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
export async function POST(request: Request) {
  return withRequestDiagnostics("session.write", async () => {
    try {
      assertSameOrigin(request); const input = await requestObject(request), jar = await cookies(), token = jar.get(SESSION_COOKIE)?.value;
      correlateCommand(input.commandId);
      if (input.action === "bootstrap") {
        exact(input, ["action"]);
        const result = await transaction((client) => bootstrap(client, token));
        if (result.token) jar.set(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: "strict", secure: new URL(applicationOrigin()).protocol === "https:", path: "/", expires: new Date(result.session.expiresAt) });
        return Response.json({ session: result.session }, { headers: PRIVATE_HEADERS });
      }
      if (!["select", "signout", "reset", "reset-profile"].includes(input.action as string)) invalid();
      const session = await transaction((client) => changeSession(client, token, input));
      return Response.json({ session }, { headers: PRIVATE_HEADERS });
    } catch (error) { return responseError(error); }
  });
}
