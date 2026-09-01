import { prisma } from "@/server/db";
import {
  evaluateWorkerStale,
  workerHealthOk,
  workerStaleAfterMinutes,
  type WorkerStaleEvaluation,
} from "@/lib/worker-stale";

export const WORKER_HEARTBEAT_KEY = "worker:lastTick";

export type WorkerTickSource = "worker" | "cron";

export type WorkerHeartbeatPayload = {
  at: string;
  source: WorkerTickSource;
  ok: boolean;
  sent: number;
  completed: number;
  waitlist: number;
  error: string | null;
};

export type ReminderErrorRow = {
  id: string;
  channel: string;
  lastError: string;
  remindAt: string;
  status: string;
  meetingTitle: string;
};

export type WorkerAdminStatus = {
  heartbeat: WorkerHeartbeatPayload | null;
  stale: boolean;
  minutesSinceTick: number | null;
  staleAfterMinutes: number;
  pollIntervalMs: number;
  reminders24h: { sent: number; failed: number };
  recentErrors: ReminderErrorRow[];
};

function parseHeartbeat(value: unknown): WorkerHeartbeatPayload | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== "string") return null;
  return {
    at: v.at,
    source: v.source === "cron" ? "cron" : "worker",
    ok: v.ok !== false,
    sent: typeof v.sent === "number" ? v.sent : 0,
    completed: typeof v.completed === "number" ? v.completed : 0,
    waitlist: typeof v.waitlist === "number" ? v.waitlist : 0,
    error: typeof v.error === "string" ? v.error : null,
  };
}

export async function readWorkerHeartbeat(): Promise<WorkerHeartbeatPayload | null> {
  const row = await prisma.systemMeta.findUnique({ where: { key: WORKER_HEARTBEAT_KEY } });
  return row ? parseHeartbeat(row.value) : null;
}

export async function recordWorkerHeartbeat(input: {
  source: WorkerTickSource;
  ok: boolean;
  sent?: number;
  completed?: number;
  waitlist?: number;
  error?: string | null;
}): Promise<void> {
  const payload: WorkerHeartbeatPayload = {
    at: new Date().toISOString(),
    source: input.source,
    ok: input.ok,
    sent: input.sent ?? 0,
    completed: input.completed ?? 0,
    waitlist: input.waitlist ?? 0,
    error: input.error?.slice(0, 500) ?? null,
  };
  await prisma.systemMeta.upsert({
    where: { key: WORKER_HEARTBEAT_KEY },
    create: { key: WORKER_HEARTBEAT_KEY, value: payload as object, updatedAt: new Date() },
    update: { value: payload as object, updatedAt: new Date() },
  });
}

export function evaluateHeartbeat(
  heartbeat: WorkerHeartbeatPayload | null,
  now = new Date(),
): WorkerStaleEvaluation {
  return evaluateWorkerStale(heartbeat?.at ?? null, now, workerStaleAfterMinutes());
}

export async function getReminderStats24h(now = new Date()): Promise<{ sent: number; failed: number }> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [sent, failed] = await Promise.all([
    prisma.meetingReminder.count({
      where: { status: "SENT", sentAt: { gte: since } },
    }),
    prisma.meetingReminder.count({
      where: {
        lastError: { not: null },
        remindAt: { gte: since },
      },
    }),
  ]);
  return { sent, failed };
}

export async function getRecentReminderErrors(limit = 20): Promise<ReminderErrorRow[]> {
  const rows = await prisma.meetingReminder.findMany({
    where: { lastError: { not: null } },
    orderBy: { remindAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      lastError: true,
      remindAt: true,
      status: true,
      meeting: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    lastError: r.lastError ?? "",
    remindAt: r.remindAt.toISOString(),
    status: r.status,
    meetingTitle: r.meeting.title,
  }));
}

export async function getWorkerAdminStatus(): Promise<WorkerAdminStatus> {
  const heartbeat = await readWorkerHeartbeat();
  const staleEval = evaluateHeartbeat(heartbeat);
  const [reminders24h, recentErrors] = await Promise.all([
    getReminderStats24h(),
    getRecentReminderErrors(),
  ]);
  return {
    heartbeat,
    stale: staleEval.stale,
    minutesSinceTick: staleEval.minutesSinceTick,
    staleAfterMinutes: staleEval.staleAfterMinutes,
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000),
    reminders24h,
    recentErrors,
  };
}

export async function getWorkerHealthResponse(now = new Date()): Promise<{
  ok: boolean;
  stale: boolean;
  lastTickAt: string | null;
  source: WorkerTickSource | null;
}> {
  const heartbeat = await readWorkerHeartbeat();
  const staleEval = evaluateHeartbeat(heartbeat, now);
  const ok = workerHealthOk(staleEval, heartbeat?.ok);
  return {
    ok,
    stale: staleEval.stale,
    lastTickAt: heartbeat?.at ?? null,
    source: heartbeat?.source ?? null,
  };
}
