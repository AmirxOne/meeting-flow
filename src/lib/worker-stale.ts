/** Pure worker stale detection — unit-tested without DB. */

export const DEFAULT_WORKER_STALE_MINUTES = 5;

export function workerStaleAfterMinutes(env: Record<string, string | undefined> = process.env): number {
  const raw = env.WORKER_STALE_MINUTES;
  if (raw == null || raw.trim() === "") return DEFAULT_WORKER_STALE_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_WORKER_STALE_MINUTES;
  return Math.min(24 * 60, Math.floor(n));
}

export type WorkerStaleEvaluation = {
  stale: boolean;
  minutesSinceTick: number | null;
  staleAfterMinutes: number;
};

/** No heartbeat ever recorded → stale (worker never ran or DB unreachable). */
export function evaluateWorkerStale(
  lastTickAt: Date | string | null | undefined,
  now: Date,
  staleAfterMinutes: number,
): WorkerStaleEvaluation {
  if (!lastTickAt) {
    return { stale: true, minutesSinceTick: null, staleAfterMinutes };
  }
  const at = lastTickAt instanceof Date ? lastTickAt : new Date(lastTickAt);
  if (Number.isNaN(at.getTime())) {
    return { stale: true, minutesSinceTick: null, staleAfterMinutes };
  }
  const ms = now.getTime() - at.getTime();
  const minutesSinceTick = Math.max(0, ms / 60_000);
  return {
    stale: minutesSinceTick > staleAfterMinutes,
    minutesSinceTick,
    staleAfterMinutes,
  };
}

export function workerHealthOk(evalResult: WorkerStaleEvaluation, tickOk: boolean | undefined): boolean {
  return !evalResult.stale && tickOk !== false;
}
