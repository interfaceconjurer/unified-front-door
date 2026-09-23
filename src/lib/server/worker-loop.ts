export const WORKER_POLL_MS = 500;
export const WORKER_RECOVERY_MS = 60 * 60 * 1000;
export const WORKER_WARM_MS = 10000;

/** Coalesce hints, including those received during a tick or just before wait.
 * The flag is cleared only before a database scan, never after one. */
export class WorkerWake {
  private pending = false;
  private waiting?: () => void;
  notify = () => { this.pending = true; this.waiting?.(); };
  take(): boolean { const pending = this.pending; this.pending = false; return pending; }
  wait(ms: number, signal: AbortSignal): Promise<void> {
    if (this.pending || signal.aborted) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer); signal.removeEventListener("abort", done);
        this.waiting = undefined; resolve();
      };
      const timer = setTimeout(done, ms);
      this.waiting = done;
      signal.addEventListener("abort", done, { once: true });
    });
  }
}

/** Claim/lease rules stay in workerTick. Sleep between web hints when the
 * durable queue is empty; hourly scans recover work despite lost hints. */
export async function runWorkerLoop(options: {
  signal: AbortSignal; wake: WorkerWake;
  tick: () => Promise<boolean>; hasWork: () => Promise<boolean>; onError: () => void;
}): Promise<void> {
  const { signal, wake } = options;
  let errorDelay = WORKER_POLL_MS, warmUntil = 0;
  while (!signal.aborted) {
    if (wake.take()) warmUntil = Date.now() + WORKER_WARM_MS;
    let delay = WORKER_POLL_MS;
    try {
      const worked = await options.tick();
      if (signal.aborted) break;
      if (worked) warmUntil = Date.now() + WORKER_WARM_MS;
      if (!worked && Date.now() >= warmUntil && !await options.hasWork()) {
        // All workers share recovery boundaries, preserving common quiet gaps.
        delay = WORKER_RECOVERY_MS - Date.now() % WORKER_RECOVERY_MS;
      }
      errorDelay = WORKER_POLL_MS;
    } catch { options.onError(); delay = errorDelay; errorDelay = Math.min(errorDelay * 2, WORKER_RECOVERY_MS); }
    await wake.wait(delay, signal);
  }
}
