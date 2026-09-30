"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Power } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { faNum, faStr, formatJalali } from "@/lib";

type WorkerAdminStatus = {
  heartbeat: {
    at: string;
    source: "worker" | "cron";
    ok: boolean;
    sent: number;
    completed: number;
    waitlist: number;
    error: string | null;
  } | null;
  stale: boolean;
  minutesSinceTick: number | null;
  staleAfterMinutes: number;
  pollIntervalMs: number;
  reminders24h: { sent: number; failed: number };
  recentErrors: {
    id: string;
    channel: string;
    lastError: string;
    remindAt: string;
    status: string;
    meetingTitle: string;
  }[];
};

function formatMinutes(m: number | null): string {
  if (m == null) return "—";
  if (m < 1) return "کمتر از ۱ دقیقه";
  return `${faNum(Math.round(m))} دقیقه`;
}

export function WorkerStatusCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-worker-status"],
    queryFn: () => api<WorkerAdminStatus>("/api/admin/worker-status"),
    refetchInterval: 30_000,
  });

  return (
    <Card data-testid="worker-status-card">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Power className="h-4 w-4 text-ink-soft" />
            وضعیت worker
            {data && (
              <span
                className={
                  "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold " +
                  (data.stale ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")
                }
              >
                <span className={"size-1.5 rounded-full " + (data.stale ? "bg-amber-500" : "bg-emerald-500")} />
                {data.stale ? "متوقف" : "فعال"}
              </span>
            )}
          </span>
        }
        subtitle="موتور پس‌زمینه: یادآورها، چرخه‌ی وضعیت جلسات و صف انتظار اتاق‌ها"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-8 w-2/3" />
          </div>
        ) : !data ? (
          <p className="text-[13px] text-ink-soft">اطلاعات worker در دسترس نیست.</p>
        ) : (
          <>
            {data.stale ? (
              <div
                className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] leading-6 text-amber-900"
                data-testid="worker-stale-alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">worker بی‌فعال یا متوقف شده</p>
                  <p className="mt-1 text-amber-800/90">
                    {data.heartbeat
                      ? `آخرین تیک ${formatMinutes(data.minutesSinceTick)} پیش — بیش از ${faNum(data.staleAfterMinutes)} دقیقه بدون tick.`
                      : "هنوز هیچ تیکی ثبت نشده است."}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-6 text-amber-800/80">
                    بدون worker، یادآورها ارسال نمی‌شوند و وضعیت جلسات به‌روز نمی‌شود. برای اجرا:
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-amber-100 px-2 py-1 font-mono text-[11px] text-amber-900 ring-1 ring-amber-200" dir="ltr">
                      pnpm worker:dev
                    </code>
                    <span className="text-[10.5px] text-amber-800/70">در توسعه</span>
                    <code className="rounded bg-amber-100 px-2 py-1 font-mono text-[11px] text-amber-900 ring-1 ring-amber-200" dir="ltr">
                      pnpm worker
                    </code>
                    <span className="text-[10.5px] text-amber-800/70">در سرور</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12px] text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">worker فعال است</p>
                  <p className="mt-1 text-emerald-800/90">
                    آخرین tick {formatMinutes(data.minutesSinceTick)} پیش
                    {data.heartbeat?.source === "cron" ? " (cron)" : " (پروسه worker)"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-paper-soft/60 px-3.5 py-3">
                <p className="text-[11px] font-medium text-ink-soft">یادآور موفق</p>
                <p className="mt-1 text-[20px] font-bold tabular-nums">{faNum(data.reminders24h.sent)}</p>
                <p className="mt-0.5 text-[10.5px] text-ink-faint">در ۲۴ ساعت گذشته</p>
              </div>
              <div className="rounded-lg border border-line bg-paper-soft/60 px-3.5 py-3">
                <p className="text-[11px] font-medium text-ink-soft">خطای ارسال</p>
                <p className={"mt-1 text-[20px] font-bold tabular-nums " + (data.reminders24h.failed > 0 ? "text-red-600" : "")}>
                  {faNum(data.reminders24h.failed)}
                </p>
                <p className="mt-0.5 text-[10.5px] text-ink-faint">در ۲۴ ساعت گذشته</p>
              </div>
            </div>

            {data.heartbeat && (
              <div className="space-y-2 text-[12px] text-ink-soft">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    آخرین tick: {formatJalali(new Date(data.heartbeat.at), { withTime: true })}
                    {!data.heartbeat.ok && data.heartbeat.error ? (
                      <span className="mr-2 text-red-600"> — خطا: {data.heartbeat.error}</span>
                    ) : null}
                  </span>
                </div>
                <p>
                  بازه poll: {faStr(String(Math.round(data.pollIntervalMs / 1000)))} ثانیه · آستانه هشدار:{" "}
                  {faNum(data.staleAfterMinutes)} دقیقه
                </p>
              </div>
            )}

            {data.recentErrors.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink">آخرین خطاهای یادآور (lastError)</p>
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-line bg-white p-2">
                  {data.recentErrors.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-md bg-paper-soft/80 px-2.5 py-2 text-[11px] leading-6"
                      data-testid="worker-reminder-error-row"
                    >
                      <p className="font-medium text-ink">{row.meetingTitle}</p>
                      <p className="text-ink-soft">
                        {row.channel} · {formatJalali(new Date(row.remindAt), { withTime: true })} · {row.status}
                      </p>
                      <p className="mt-1 break-words font-mono text-[10px] text-red-700" dir="ltr">
                        {row.lastError}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
