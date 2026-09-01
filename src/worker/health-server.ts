import http from "node:http";
import { evaluateWorkerStale, workerHealthOk, workerStaleAfterMinutes } from "@/lib/worker-stale";

export type WorkerHealthSnapshot = {
  ok: boolean;
  stale: boolean;
  lastTickAt: string | null;
  lastTickOk: boolean | null;
  minutesSinceTick: number | null;
};

let lastTickAt: Date | null = null;
let lastTickOk: boolean | null = null;

/** Called by worker after each tick attempt (in-memory for fast health checks). */
export function noteWorkerTick(ok: boolean): void {
  lastTickAt = new Date();
  lastTickOk = ok;
}

export function getWorkerHealthSnapshot(now = new Date()): WorkerHealthSnapshot {
  const staleEval = evaluateWorkerStale(lastTickAt, now, workerStaleAfterMinutes());
  const ok = workerHealthOk(staleEval, lastTickOk ?? undefined);
  return {
    ok,
    stale: staleEval.stale,
    lastTickAt: lastTickAt?.toISOString() ?? null,
    lastTickOk,
    minutesSinceTick: staleEval.minutesSinceTick,
  };
}

export function startWorkerHealthServer(port = Number(process.env.WORKER_HEALTH_PORT ?? 3101)): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url !== "/health" && req.url !== "/health/") {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }
    const snap = getWorkerHealthSnapshot();
    res.writeHead(snap.ok ? 200 : 503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(snap));
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`[worker] health http://127.0.0.1:${port}/health`);
  });
  return server;
}
