"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2, Pencil, CheckCircle2, XCircle, History, Activity, Search } from "@/components/ui/icon";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { api } from "@/lib/api";
import { Card, CardHeader, SkeletonBlock, SkeletonTable, EmptyState } from "@/components/ui/card";
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

/** گروه معنایی هر عملیات برای رنگ و آیکون */
type ActionKind = "create" | "update" | "delete" | "approve" | "reject" | "info";

function actionKind(action: string): ActionKind {
  if (action === "CREATE" || action.endsWith("_CREATE") || action.endsWith("_UPLOAD") || action === "PARTICIPANT_ADD") return "create";
  if (action === "DELETE" || action.endsWith("_DELETE") || action === "PARTICIPANT_REMOVE" || action.endsWith("_REVOKE")) return "delete";
  if (action.includes("REJECT") || action.includes("CANCEL") || action.includes("DECLINE")) return "reject";
  if (action.includes("APPROVE") || action === "MEETING_END" || action === "MINUTES_PUBLISH" || action === "WAITLIST_CLAIM") return "approve";
  if (action === "UPDATE" || action.endsWith("_UPDATE") || action.includes("CHANGE") || action === "MEETING_START" || action === "MEETING_EXTEND" || action === "MEETING_RESCHEDULE") return "update";
  return "info";
}

const KIND_STYLE: Record<ActionKind, { icon: ReactNode; chip: string; iconWrap: string }> = {
  create: { icon: <Plus className="h-3.5 w-3.5" />, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", iconWrap: "bg-emerald-100 text-emerald-700" },
  update: { icon: <Pencil className="h-3.5 w-3.5" />, chip: "bg-blue-50 text-blue-700 border-blue-200", iconWrap: "bg-blue-100 text-blue-700" },
  delete: { icon: <Trash2 className="h-3.5 w-3.5" />, chip: "bg-paper-deep text-ink-faint border-line", iconWrap: "bg-paper-deep text-ink-faint" },
  approve: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", iconWrap: "bg-emerald-100 text-emerald-700" },
  reject: { icon: <XCircle className="h-3.5 w-3.5" />, chip: "bg-red-50 text-red-700 border-red-200", iconWrap: "bg-red-100 text-red-700" },
  info: { icon: <History className="h-3.5 w-3.5" />, chip: "bg-paper-soft text-ink-soft border-line", iconWrap: "bg-paper-soft text-ink-soft" },
};

/** جمله‌ی انسانی برای هر رخداد */
function describeLog(log: AuditRow): string {
  const who = log.actor?.fullName ?? "سیستم";
  const what = ACTION_FA[log.action] ?? log.action;
  const entity = ENTITY_FA[log.entity] ?? log.entity;
  return `${who} — ${what} (${entity})`;
}

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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [entityId, setEntityId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (entity) qs.set("entity", entity);
    if (action) qs.set("action", action);
    if (actorId) qs.set("actorId", actorId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (q.trim()) qs.set("q", q.trim());
    if (entityId.trim()) qs.set("entityId", entityId.trim());
    return qs.toString();
  }, [page, entity, action, actorId, from, to, q, entityId]);

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

  const anyFilterActive = !!(entity || action || actorId || from || to || q.trim() || entityId.trim());

  function clearAll() {
    setEntity("");
    setAction("");
    setActorId("");
    setFrom("");
    setTo("");
    setQ("");
    setEntityId("");
    setPage(1);
    setExpandedId(null);
  }

  if (!can("audit:view")) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مشاهده لاگ ممیزی نیازمند دسترسی audit:view است.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
          <History className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold leading-tight">لاگ ممیزی</h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            {faNum(data?.total ?? 0)} رخداد — هر تغییر مهم سیستم با جزئیات «قبلی/جدید» ثبت می‌شود
          </p>
        </div>
      </div>

      {/* پنل فیلتر یکپارچه */}
      <Card data-tour="audit-filters" className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* جستجوی سراسری */}
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="جستجو در نام کاربر، عملیات یا شناسه…"
              className="h-10 w-full rounded-md border border-line bg-white pr-9 pl-3 text-[12.5px] outline-none transition-colors placeholder:text-ink-faint focus:border-ink/50"
            />
          </div>
          {/* بازه تاریخ */}
          <div className="flex items-center gap-1.5">
            <JalaliDatePicker value={from} onChange={(v) => { setFrom(v); setPage(1); }} placeholder="از تاریخ" className="w-[130px]" />
            <span className="text-[11px] text-ink-faint">تا</span>
            <JalaliDatePicker value={to} onChange={(v) => { setTo(v); setPage(1); }} placeholder="تا تاریخ" className="w-[130px]" />
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 border-t border-line/70 pt-2.5">
          {/* موجودیت */}
          <div className="w-44">
            <Select
              value={entity}
              onChange={(v) => handleFilterChange({ entity: v, action })}
              placeholder="موجودیت: همه"
              options={[
                { value: "", label: "موجودیت: همه" },
                ...Object.entries(ENTITY_FA).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          {/* عملیات */}
          <div className="w-44">
            <Select
              value={action}
              onChange={(v) => handleFilterChange({ entity, action: v })}
              placeholder="عملیات: همه"
              options={[
                { value: "", label: "عملیات: همه" },
                ...Object.entries(ACTION_FA).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
          {/* کاربر */}
          <div className="w-44">
            <Select
              value={actorId}
              onChange={(v) => { setActorId(v); setPage(1); setExpandedId(null); }}
              placeholder="کاربر: همه"
              options={[
                { value: "", label: "کاربر: همه" },
                ...users.map((u) => ({ value: u.id, label: u.fullName })),
              ]}
            />
          </div>
          {/* شناسه موجودیت */}
          <input
            value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setPage(1); }}
            dir="ltr"
            placeholder="شناسه‌ی موجودیت (اختیاری)"
            className="h-10 w-48 rounded-md border border-line bg-white px-3 text-left font-mono text-[12px] outline-none transition-colors placeholder:font-sans placeholder:text-right placeholder:text-ink-faint focus:border-ink/50"
          />
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearAll}
              className="h-10 shrink-0 rounded-md border border-dashed border-line px-3 text-[11px] text-ink-soft transition hover:border-danger/40 hover:text-danger"
            >
              حذف فیلترها
            </button>
          )}
          <span className="mr-auto text-[11px] text-ink-faint">
            {faNum(data?.total ?? 0)} رخداد مطابق
            {(data?.logs ?? []).length > 0 ? ` · ${faNum((data?.logs ?? []).length)} در این صفحه` : ""}
          </span>
        </div>
      </Card>

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
            title={
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-paper-soft text-ink-soft">
                  <Activity className="h-4 w-4" />
                </span>
                تایم‌لاین رخدادها
              </span>
            }
            subtitle="روی ردیف‌های دارای جزئیات کلیک کنید تا تغییرات «قبلی ← جدید» را ببینید"
          />
          {(data?.logs ?? []).length === 0 ? (
            <EmptyState
              title="لاگی یافت نشد"
              description="فیلترها را تغییر دهید یا عملیاتی در سیستم انجام دهید تا ردپا اینجا ثبت شود"
            />
          ) : (
            <ul className="divide-y divide-line">
              {(data?.logs ?? []).map((log) => {
                const expandable = hasAuditPayload(log);
                const open = expandedId === log.id;
                const kind = actionKind(log.action);
                const style = KIND_STYLE[kind];
                return (
                  <Fragment key={log.id}>
                    <li
                      data-log={log.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-soft/40",
                        open && "bg-paper-soft/30",
                      )}
                      onClick={() => {
                        if (!expandable) return;
                        setExpandedId(open ? null : log.id);
                      }}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", style.iconWrap)}>
                        {style.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[12.5px] font-bold">{log.actor?.fullName ?? "سیستم"}</span>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px]", style.chip)}>
                            {ACTION_FA[log.action] ?? log.action}
                          </span>
                          <span className="text-[11.5px] text-ink-soft">{ENTITY_FA[log.entity] ?? log.entity}</span>
                          {log.entityId ? (
                            <span className="text-[10px] text-ink-faint" dir="ltr">{faStr(log.entityId.slice(0, 8))}…</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-ink-faint">
                          {formatJalali(new Date(log.createdAt), { withTime: true })}
                          {log.ip && log.ip !== "::1" ? ` · ${faStr(log.ip)}` : ""}
                        </p>
                      </div>
                      {expandable && (
                        <span className="shrink-0 text-ink-faint">
                          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      )}
                    </li>
                    {open && expandable && (
                      <li className="bg-paper-soft/20 px-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <AuditValueBlock title="مقدار قبلی" value={log.oldValue} />
                          <AuditValueBlock title="مقدار جدید" value={log.newValue} />
                        </div>
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
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
