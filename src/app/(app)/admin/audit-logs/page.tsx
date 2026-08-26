"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock, SkeletonTable, EmptyState } from "@/components/ui/card";
import { cn, faNum, faStr, formatJalali } from "@/lib";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
}

const ACTION_FA: Record<string, string> = {
  CREATE: "ایجاد",
  UPDATE: "ویرایش",
  MEETING_APPROVE: "تأیید جلسه",
  MEETING_REJECT: "رد جلسه",
  MEETING_CANCEL: "لغو جلسه",
  MEETING_RESCHEDULE: "زمان‌بندی مجدد",
  MEETING_ROOM_CHANGE: "تغییر اتاق",
  MEETING_START: "شروع جلسه",
  MEETING_END: "پایان جلسه",
  MEETING_EXTEND: "تمدید جلسه",
  PARTICIPANT_ADD: "افزودن فرد",
  PARTICIPANT_REMOVE: "حذف فرد",
  POLICY_UPDATE: "تغییر سیاست",
};

const ENTITY_FA: Record<string, string> = {
  Meeting: "جلسه",
  User: "کاربر",
  MeetingRoom: "اتاق",
  MeetingPolicy: "سیاست",
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api<{ logs: AuditRow[]; total: number; pageSize: number }>("/api/admin/audit-logs?page=" + page),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">لاگ ممیزی</h1>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="mt-1 h-3 w-28" />
          </div>
          <SkeletonTable rows={8} cols={5} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`${faNum(data?.total ?? 0)} رخداد ثبت‌شده`}
            subtitle="تمام عملیات مهم سیستم"
          />
          {(data?.logs ?? []).length === 0 ? (
            <EmptyState title="لاگی ثبت نشده" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[12px]">
                <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">زمان</th>
                    <th className="px-4 py-2.5 font-medium">کاربر</th>
                    <th className="px-4 py-2.5 font-medium">عملیات</th>
                    <th className="px-4 py-2.5 font-medium">موجودیت</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data?.logs ?? []).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 text-ink-soft">
                        {formatJalali(new Date(log.createdAt), { withTime: true })}
                      </td>
                      <td className="px-4 py-2.5">{log.actor?.fullName ?? "سیستم"}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("badge", log.action.includes("REJECT") || log.action.includes("CANCEL") ? "badge-red" : "badge-gray")}>
                          {ACTION_FA[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">
                        {ENTITY_FA[log.entity] ?? log.entity}
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-faint lg:table-cell" dir="ltr">
                        {log.ip && log.ip !== "::1" ? faStr(log.ip) : log.ip === "::1" ? "محلی" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-line p-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-line px-3 py-1.5 text-[12px] disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-[12px] text-ink-soft">
                صفحه {faNum(page)} از {faNum(totalPages)}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-line px-3 py-1.5 text-[12px] disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
