"use client";

/**
 * کارت واحد «زیرساخت و هوش مصنوعی» — وضعیت worker + پروایدرهای AI در یک‌جا.
 * آیکون هر ردیف وضعیت را نشان می‌دهد: سبز = فعال/سالم، خاکستری = غیرفعال/مشکل.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib";
import { ChevronDown, Clock, Sparkles } from "@/components/ui/icon";
import { WorkerStatusCard } from "./worker-status-card";
import { AiProvidersCard } from "./ai-providers-card";

export function InfrastructureCard() {
  const [openRow, setOpenRow] = useState<"worker" | "ai" | null>("worker");

  // وضعیت زنده برای رنگ آیکون‌ها
  const workerQ = useQuery({
    queryKey: ["admin-worker-status"],
    queryFn: () => api<{ stale: boolean }>("/api/admin/worker-status"),
    refetchInterval: 30_000,
  });
  const aiQ = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api<{ providers: unknown[] }>("/api/admin/ai-providers"),
  });

  const workerOn = workerQ.data ? !workerQ.data.stale : null;
  const aiOn = aiQ.data ? (aiQ.data.providers?.length ?? 0) > 0 : null;

  const Row = ({
    id, icon, title, hint, on, children,
  }: {
    id: "worker" | "ai"; icon: React.ReactNode; title: string; hint: string;
    on: boolean | null; children: React.ReactNode;
  }) => {
    const open = openRow === id;
    return (
      <div className={open ? "rounded-lg bg-paper-soft/40" : "rounded-lg"}>
        <button
          type="button"
          onClick={() => setOpenRow(open ? null : id)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              on === null ? "bg-ink/5 text-ink-soft"
                : on ? "bg-emerald-50 text-emerald-600"
                : "bg-paper-soft text-ink-faint ring-1 ring-line",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-bold">{title}</span>
              {on !== null && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[9.5px] font-bold",
                  on ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint ring-1 ring-line",
                )}>
                  {on ? "فعال" : "غیرفعال"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-5 text-ink-faint">{hint}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open && <div className="border-t border-line/70 pb-2 pt-2">{children}</div>}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold">زیرساخت و هوش مصنوعی</h3>
          <div className="mt-0.5 text-[12px] leading-5 text-ink-soft">موتور پس‌زمینه و پروایدرهای AI — وضعیت و کلیدها</div>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <Row
          id="worker"
          icon={<Clock className="h-[18px] w-[18px]" />}
          title="وضعیت worker"
          hint={workerOn === false ? "متوقف — تیک‌ها اجرا نمی‌شوند" : "یادآورها، چرخه‌ی وضعیت جلسات و صف اتاق‌ها"}
          on={workerOn}
        >
          <WorkerStatusCard />
        </Row>
        <Row
          id="ai"
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          title="پروایدرهای هوش مصنوعی"
          hint={aiOn ? "کلیدهای API رمزنگاری‌شده — هرگز نمایش داده نمی‌شوند" : "هیچ پروایدری ثبت نشده است"}
          on={aiOn}
        >
          <AiProvidersCard />
        </Row>
      </div>
    </div>
  );
}
