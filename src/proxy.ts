// Server-side HTTP Basic Auth gate for the whole app, mirroring the Express
// gate used by the sf-heroku-compute prototype but expressed as a Next.js
// proxy (the Next 16 successor to `middleware`; runs before every request).
//
// Credentials come from environment (Heroku config vars), never committed:
//   BASIC_AUTH_USER      username for the browser prompt (default: "guest")
//   BASIC_AUTH_PASSWORD  shared password (required; the gate fails closed if unset)
import { NextRequest, NextResponse } from "next/server";

const REALM = "Unified Front Door prototype";

// Constant-time comparison that also tolerates length differences. Compared
// over UTF-8 bytes so non-ASCII credentials behave the same as the Node gate.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < ab.length; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function challenge(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

export function proxy(req: NextRequest): NextResponse {
  const expectedUser = process.env.BASIC_AUTH_USER || "guest";
  const expectedPass = process.env.BASIC_AUTH_PASSWORD;

  // Fail closed: never serve the site unprotected if no password is configured.
  if (!expectedPass) {
    return new NextResponse(
      "Site not configured: BASIC_AUTH_PASSWORD is not set.",
      { status: 503 }
    );
  }

  const header = req.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      decoded = new TextDecoder().decode(bytes);
    } catch {
      return challenge();
    }
    const sep = decoded.indexOf(":");
    if (sep !== -1) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      // Evaluate both halves before branching so the response time does not
      // reveal which field was wrong.
      const userOk = safeEqual(user, expectedUser);
      const passOk = safeEqual(pass, expectedPass);
      if (userOk && passOk) {
        return NextResponse.next();
      }
    }
  }

  return challenge();
}

// Gate every request. Static assets are intentionally included: once the
// browser has the credentials it attaches them to all same-origin requests,
// so nothing is served before authentication.
export const config = {
  matcher: ["/:path*"],
};
