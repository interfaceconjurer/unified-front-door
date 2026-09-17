import "server-only";
import { ApplicationError, invalid, record, text } from "../application/contracts";
import { diagnoseError } from "./diagnostics";
import { applicationOrigin } from "./configuration";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
export function assertSameOrigin(request: Request): void {
  const expected = applicationOrigin();
  if (request.headers.get("origin") !== expected || request.headers.get("x-ufd-mutation") !== "1"
    || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    throw new ApplicationError("unauthorized", "This mutation must originate from this application.", 403);
  }
}
export async function requestObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) invalid();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 4500000) invalid("The request is too large.");
  const reader = request.body?.getReader(); if (!reader) invalid();
  let bytes = 0, body = ""; const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 4500000) { await reader.cancel(); invalid("The request is too large."); } body += decoder.decode(value, { stream: true }); }
    body += decoder.decode();
  } catch (error) { if (error instanceof ApplicationError) throw error; invalid(); }
  let value: unknown; try { value = JSON.parse(body); } catch { invalid(); }
  if (!record(value)) invalid(); return value;
}
export function requireGeneration(value: unknown): string { if (!text(value, 100)) invalid(); return value; }
export function responseError(error: unknown): Response {
  diagnoseError(error);
  if (error instanceof ApplicationError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: PRIVATE_HEADERS });
  // Never send driver details, SQL, hostnames, connection strings, or stack traces.
  return Response.json({ error: { code: "unavailable", message: "Database saving is unavailable. A previous request may have committed; retry uses the same command ID." } }, { status: 503, headers: PRIVATE_HEADERS });
}
