"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock, SkeletonTable, EmptyState } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { cn, faNum, faStr, formatJalali } from "@/lib";
import { useAuth } from "@/lib/auth-store";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ip: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
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
  ATTACHMENT_UPLOAD: "آپلود پیوست",
  ATTACHMENT_DELETE: "حذف پیوست",
  AGENDA_UPDATE: "ویرایش دستور جلسه",
  MINUTES_PUBLISH: "ثبت صورتجلسه",
  VIDEO_LINK_UPDATE: "ویرایش لینک ویدئو",
  SMS_TEST: "پیامک آزمایشی",
  DELETE: "حذف",
  WAITLIST_CLAIM: "قطعی کردن لیست انتظار",
  WAITLIST_DECLINE: "رد پیشنهاد لیست انتظار",
  HOLIDAY_CREATE: "ثبت تعطیلی",
  HOLIDAY_DELETE: "حذف تعطیلی",
  MAP_UPLOAD: "آپلود نقشه شعبه",
  MAP_DELETE: "حذف نقشه شعبه",
  AVATAR_UPLOAD: "آپلود تصویر پروفایل",
  AVATAR_DELETE: "حذف تصویر پروفایل",
  DISPLAY_TOKEN: "توکن نمایشگر اتاق",
  DISPLAY_TOKEN_REVOKE: "باطل کردن نمایشگر اتاق",
};

const ENTITY_FA: Record<string, string> = {
  Meeting: "جلسه",
  User: "کاربر",
  MeetingRoom: "اتاق",
  MeetingPolicy: "سیاست",
  MeetingAttachment: "پیوست",
  Organization: "سازمان",
  Sms: "پیامک",
  Branch: "شعبه",
  Floor: "طبقه",
  Delegate: "نماینده رزرو",
  OrgHoliday: "تعطیلی سازمانی",
};

const FIELD_FA: Record<string, string> = {
  name: "نام",
  title: "عنوان",
  status: "وضعیت",
  email: "ایمیل",
  fullName: "نام کامل",
  timezone: "منطقه زمانی",
  logoUrl: "لوگو",
  legalName: "نام حقوقی",
  capacity: "ظرفیت",
  branchId: "شناسه شعبه",
  roomId: "شناسه اتاق",
};

function hasAuditPayload(log: AuditRow): boolean {
  return log.oldValue != null || log.newValue != null;
}

function formatAuditJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return faStr(JSON.stringify(value, null, 2));
  } catch {
    return faStr(String(value));
  }
}

function AuditValueBlock({ title, value }: { title: string; value: unknown }) {
  const entries =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>)
      : null;

  return (
    <div className="rounded-md border border-line bg-paper-soft/30 p-3">
      <p className="mb-2 text-[11px] font-bold text-ink-soft">{title}</p>
      {entries && entries.length > 0 ? (
        <dl className="space-y-1.5 text-[12px]">
          {entries.map(([key, val]) => (
            <div key={key} className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="font-medium text-ink">{FIELD_FA[key] ?? key}:</dt>
              <dd className="text-ink-soft">{formatAuditJson(val)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre dir="ltr" className="overflow-x-auto whitespace-pre-wrap text-left text-[11px] leading-relaxed text-ink-soft">
          {formatAuditJson(value)}
        </pre>
      )}
    </div>
  );
}

export function AuditLogsPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (entity) q.set("entity", entity);
    if (action) q.set("action", action);
    if (actorId) q.set("actorId", actorId);
    return q.toString();
  }, [page, entity, action, actorId]);

  const { data: usersData } = useQuery({
    queryKey: ["users", "audit-filter"],
    queryFn: () => api<{ users: { id: string; fullName: string }[] }>("/api/users"),
    enabled: can("audit:view"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit", queryString],
    queryFn: () =>
      api<{ logs: AuditRow[]; total: number; pageSize: number }>(`/api/admin/audit-logs?${queryString}`),
    enabled: can("audit:view"),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const users = usersData?.users ?? [];

  function handleFilterChange(v: Record<string, string>) {
    setEntity(v.entity ?? "");
    setAction(v.action ?? "");
    setPage(1);
    setExpandedId(null);
  }

  if (!can("audit:view")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مشاهده لاگ ممیزی نیازمند دسترسی audit:view است.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">لاگ ممیزی</h1>

      <FilterBar
        groups={[
          {
            key: "entity",
            label: "موجودیت",
            options: [
              { value: "", label: "همه" },
              ...Object.entries(ENTITY_FA).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            key: "action",
            label: "عملیات",
            options: [
              { value: "", label: "همه" },
              ...Object.entries(ACTION_FA).map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
        value={{ entity, action }}
        onChange={handleFilterChange}
      />

      <div className="max-w-sm">
        <label className="mb-1.5 block text-[12px] font-medium">کاربر</label>
        <Select
          value={actorId}
          onChange={(v) => {
            setActorId(v);
            setPage(1);
            setExpandedId(null);
          }}
          placeholder="همه کاربران"
          options={[
            { value: "", label: "همه کاربران" },
            ...users.map((u) => ({ value: u.id, label: u.fullName })),
          ]}
        />
      </div>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="mt-1 h-3 w-28" />
          </div>
          <SkeletonTable rows={8} cols={6} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`${faNum(data?.total ?? 0)} رخداد ثبت‌شده`}
            subtitle="تمام عملیات مهم سیستم — برای جزئیات روی ردیف کلیک کنید"
          />
          {(data?.logs ?? []).length === 0 ? (
            <EmptyState
              title="لاگی یافت نشد"
              description="فیلترها را تغییر دهید یا عملیاتی در سیستم انجام دهید تا ردپا اینجا ثبت شود"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-[12px]">
                <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                  <tr>
                    <th className="w-8 px-2 py-2.5" />
                    <th className="px-4 py-2.5 font-medium">زمان</th>
                    <th className="px-4 py-2.5 font-medium">کاربر</th>
                    <th className="px-4 py-2.5 font-medium">عملیات</th>
                    <th className="px-4 py-2.5 font-medium">موجودیت</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data?.logs ?? []).map((log) => {
                    const expandable = hasAuditPayload(log);
                    const open = expandedId === log.id;
                    return (
                      <Fragment key={log.id}>
                        <tr
                          className={cn(expandable && "cursor-pointer hover:bg-paper-soft/40")}
                          onClick={() => {
                            if (!expandable) return;
                            setExpandedId(open ? null : log.id);
                          }}
                        >
                          <td className="px-2 py-2.5 text-ink-faint">
                            {expandable ? (
                              open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-ink-soft">
                            {formatJalali(new Date(log.createdAt), { withTime: true })}
                          </td>
                          <td className="px-4 py-2.5">{log.actor?.fullName ?? "سیستم"}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "badge",
                                log.action.includes("REJECT") || log.action.includes("CANCEL")
                                  ? "badge-red"
                                  : "badge-gray",
                              )}
                            >
                              {ACTION_FA[log.action] ?? log.action}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-ink-soft">
                            {ENTITY_FA[log.entity] ?? log.entity}
                            {log.entityId ? (
                              <span className="mr-1.5 text-[10px] text-ink-faint">({faStr(log.entityId.slice(0, 8))}…)</span>
                            ) : null}
                          </td>
                          <td className="hidden px-4 py-2.5 text-ink-faint lg:table-cell" dir="ltr">
                            {log.ip && log.ip !== "::1" ? faStr(log.ip) : log.ip === "::1" ? "محلی" : "—"}
                          </td>
                        </tr>
                        {open && expandable && (
                          <tr className="bg-paper-soft/20">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <AuditValueBlock title="مقدار قبلی" value={log.oldValue} />
                                <AuditValueBlock title="مقدار جدید" value={log.newValue} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-line p-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  setExpandedId(null);
                }}
                className="rounded-md border border-line px-3 py-1.5 text-[12px] disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-[12px] text-ink-soft">
                صفحه {faNum(page)} از {faNum(totalPages)}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                  setExpandedId(null);
                }}
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
