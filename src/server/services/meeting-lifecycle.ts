/**
 * Auto-close / no-show rules for worker `processMeetingLifecycle`.
 *
 * After scheduled `endAt` + MEETING_END_GRACE_MS the worker closes stale meetings:
 *
 * 1. CONFIRMED | RESCHEDULED without a STARTED event → NO_SHOW (slot passed, never started).
 * 2. IN_PROGRESS without a STARTED event → NO_SHOW (anomaly / never really opened).
 * 3. IN_PROGRESS with a STARTED event → COMPLETED (was opened, auto-finish after grace).
 *
 * Manual end via POST /api/meetings/:id/end with `{ noShow: true }` marks NO_SHOW from IN_PROGRESS.
 * Reports `noShowRate` counts meetings with status NO_SHOW in the filtered set.
 */

/** Grace period after scheduled end before auto-close (15 minutes). */
export const MEETING_END_GRACE_MS = 15 * 60 * 1000;

export const STALE_MEETING_STATUSES = ["CONFIRMED", "RESCHEDULED", "IN_PROGRESS"] as const;

export function isPastEndGrace(
  endAt: Date,
  now: Date,
  graceMs: number = MEETING_END_GRACE_MS,
): boolean {
  return now.getTime() > endAt.getTime() + graceMs;
}

/** Decide auto-close target status for a meeting past end + grace. */
export function resolveStaleMeetingStatus(input: {
  status: string;
  hasStartedEvent: boolean;
}): "NO_SHOW" | "COMPLETED" | null {
  if (!STALE_MEETING_STATUSES.includes(input.status as (typeof STALE_MEETING_STATUSES)[number])) {
    return null;
  }
  if (input.status === "IN_PROGRESS") {
    return input.hasStartedEvent ? "COMPLETED" : "NO_SHOW";
  }
  // CONFIRMED | RESCHEDULED — never entered IN_PROGRESS
  return input.hasStartedEvent ? "COMPLETED" : "NO_SHOW";
}
