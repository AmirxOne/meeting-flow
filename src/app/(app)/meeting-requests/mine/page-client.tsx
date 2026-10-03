"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "@/components/ui/icon";
import { Clock, ArrowLeft, Bell } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, formatJalali } from "@/lib";
import { StatusChip, type MyRequest } from "@/components/ui/request-status";

const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری — در اسرع وقت",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف — هر زمان مناسب",
};

/** Employee: my submitted requests + their status (open / scheduled / rejected). */
export function MyRequestsPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const sp = useSearchParams();
  const [justSubmitted, setJustSubmitted] = useState(sp.get("submitted") === "1");
  useEffect(() => {
    if (!justSubmitted) return;
    const t = window.setTimeout(() => setJustSubmitted(false), 6000);
    // پاک‌کردن پارامتر آدرس بدون ریلود
    window.history.replaceState(null, "", "/meeting-requests/mine");
    return () => window.clearTimeout(t);
  }, [justSubmitted]);
  const { data, isLoading } = useQuery({
    queryKey: ["meeting-requests", "mine"],
    queryFn: () => api<{ items: MyRequest[]; total: number }>("/api/meeting-requests"),
  });

  const mine = data?.items ?? [];
  const open = mine.filter((r) => r.status === "OPEN");
  const closed = mine.filter((r) => r.status !== "OPEN");

  async function cancel(r: MyRequest) {
    try {
      await api(`/api/meeting-requests/${r.id}`, { method: "PATCH", json: { action: "cancel" } });
      push("درخواست لغو شد", "success");
      qc.invalidateQueries({ queryKey: ["meeting-requests"] });
    } catch (e) {
      push((e as Error).message || "خطا در لغو", "error");
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold">درخواست‌های من</h1>
          <p className="mt-1 text-[12px] leading-6 text-ink-soft">
            وضعیت درخواست‌هایی که ثبت کرده‌اید — در انتظار هماهنگی، زمان‌بندی‌شده یا ردشده
          </p>
        </div>
        <Link
          href="/meeting-requests"
          className="flex h-10 items-center rounded-md border border-line bg-white px-4 text-[12px] font-medium text-ink transition-colors hover:bg-paper-soft"
        >
          <ArrowLeft className="ml-1 h-3.5 w-3.5 rotate-180" />
          ثبت درخواست جدید
        </Link>
      </div>

      {justSubmitted && (
        <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-[13px] font-bold">درخواست شما ثبت شد</p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-emerald-700/90">
              هماهنگی به‌زودی بررسی می‌کند؛ وضعیت همین‌جا و از زنگ اعلان دنبال کنید.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title={`در انتظار هماهنگی (${faNum(open.length)})`} />
        <CardBody>
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <div className="flex-1 space-y-1.5">
                    <SkeletonBlock className="h-3.5 w-2/5" />
                    <SkeletonBlock className="h-3 w-1/4" />
                  </div>
                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : open.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-10 w-10" />}
              title="درخواست بازی ندارید"
              description="هر درخواستی ثبت کنید، وضعیتش این‌جا می‌آید"
            />
          ) : (
            <div className="space-y-2">
              {open.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                      {"isPrivate" in r && (r as { isPrivate?: boolean }).isPrivate && (
                        <span className="rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-bold text-white">محرمانه</span>
                      )}
                      {r.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                      <Clock className="h-3 w-3" />
                      {faNum(Math.round(r.durationMin / 60) || 1)} ساعت · {URGENCY_FA[r.urgency] ?? r.urgency}
                      {"createdAt" in r && (r as { createdAt?: string }).createdAt
                        ? ` · ثبت: ${formatJalali(new Date((r as { createdAt: string }).createdAt), { withTime: true })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={r.status} />
                    <Button size="sm" variant="outline" onClick={() => cancel(r)}>
                      لغو درخواست
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader title="پردازش‌شده" />
          <CardBody className="space-y-2">
            {closed.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 opacity-80">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {faNum(Math.round(r.durationMin / 60) || 1)} ساعت · {URGENCY_FA[r.urgency] ?? r.urgency}
                  </p>
                </div>
                <StatusChip status={r.status} />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
