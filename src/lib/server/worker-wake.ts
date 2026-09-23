import "server-only";
import { applicationOrigin, basicAuth } from "./configuration";
import { WorkerWake } from "./worker-loop";

/** Wait on the existing web process, not on a connection to sleeping Postgres.
 * Empty responses/errors never create a DB wake. No redirect may receive auth. */
export async function watchWorkerActivity(options: {
  signal: AbortSignal; wake: WorkerWake;
  onState: (state: "available" | "unavailable") => void;
}): Promise<void> {
  const auth = basicAuth(), url = applicationOrigin() + "/api/worker/wake";
  const authorization = "Basic " + Buffer.from(`${auth.user}:${auth.password}`).toString("base64");
  const wait = new WorkerWake();
  let previous: string | undefined, failureDelay = 5000;
  while (!options.signal.aborted) {
    let delay = 0;
    try {
      const response = await fetch(url, { headers: { authorization }, cache: "no-store", redirect: "error",
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(25000)]) });
      if (!response.ok) { await response.body?.cancel(); throw new Error("Wake endpoint unavailable"); }
      const value = await response.json();
      if (typeof value?.active !== "boolean") throw new Error("Invalid wake response");
      if (previous !== "available") { previous = "available"; options.onState("available"); }
      failureDelay = 5000;
      if (value.active) { options.wake.notify(); delay = 5000; }
      else delay = 1000; // Bound request rate even if an intermediary responds early.
    } catch {
      if (options.signal.aborted) return;
      if (previous !== "unavailable") { previous = "unavailable"; options.onState("unavailable"); }
      delay = failureDelay; failureDelay = Math.min(failureDelay * 2, 60000);
    }
    await wait.wait(delay, options.signal);
  }
}
