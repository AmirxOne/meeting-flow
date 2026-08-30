import type { NextRequest } from "next/server";

/** Verify cron/manual tick calls when WORKER_TICK_SECRET is configured. */
export function verifyWorkerTickSecret(req: NextRequest): boolean {
  const secret = process.env.WORKER_TICK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-worker-secret") === secret;
}

export function isWorkerTickEnabled(): boolean {
  return !!process.env.WORKER_TICK_SECRET?.trim();
}
