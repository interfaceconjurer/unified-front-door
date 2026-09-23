// Process-local hint only. The database remains authoritative and workers do
// periodic durable scans in case this process restarts or a hint is missed.
export function workerActivity({ now = Date.now, activeMs = 60000, waitMs = 20000 } = {}) {
  let activeUntil = 0, closed = false;
  const waiting = new Set();
  const active = () => now() < activeUntil;
  return {
    touch() { if (closed) return; activeUntil = now() + activeMs; for (const finish of [...waiting]) finish(); },
    handle(request, response) {
      let timer;
      const finish = () => {
        clearTimeout(timer); waiting.delete(finish); response.removeListener('close', cleanup);
        if (!response.destroyed) {
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
          response.end(JSON.stringify({ active: active() }));
        }
      };
      const cleanup = () => { clearTimeout(timer); waiting.delete(finish); };
      if (active() || closed) { finish(); return; }
      waiting.add(finish); response.once('close', cleanup);
      timer = setTimeout(finish, waitMs);
    },
    close() { closed = true; activeUntil = 0; for (const finish of [...waiting]) finish(); },
  };
}
