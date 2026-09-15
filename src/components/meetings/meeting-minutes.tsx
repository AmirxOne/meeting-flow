"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Check, CheckCheck, ShieldCheck, Plus, Trash2, X } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";

type Minutes = {
  id: string;
  summary: string | null;
  body: string | null;
  status: string;
  decisions?: { id: string; text: string; owner?: { fullName: string } | null; dueAt?: string | null }[];
  publishedBy?: { fullName: string };
  updatedAt: string;
};

type Topic = {
  id: string;
  title: string;
  reviewStatus: string;
  notes: string | null;
  decisions: string | null;
  actions: string | null;
  visibility: string;
};

type Access = { acls: { section: string; sectionFa: string; level: string; allowedUserIds: string[] }[]; secretaries: { id: string; fullName: string }[] };

const STATUS_FA: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "پیش‌نویس", cls: "bg-gray-100 text-gray-600" },
  PENDING_APPROVAL: { label: "در انتظار تأیید", cls: "bg-amber-50 text-amber-700" },
  APPROVED: { label: "تأییدشده", cls: "bg-blue-50 text-blue-700" },
  FINAL: { label: "نهایی‌شده", cls: "bg-emerald-50 text-emerald-700" },
};

const REVIEW_FA: Record<string, string> = {
  COVERED: "بررسی‌شده",
  PARTIAL: "بررسی ناقص",
  SKIPPED: "بررسی‌نشده",
};

/** صوظجلسه محرمانه — tabs: خلاصه | متن کامل | موضوعات | دسترسی */
export function MeetingMinutes({ meetingId }: { meetingId: string }) {
  const [tab, setTab] = useState<"summary" | "body" | "topics" | "access">("summary");
  const { push } = useToast();
  const qc = useQueryClient();
  const { me } = useAuth();

  const { data } = useQuery({
    queryKey: ["minutes", meetingId],
    queryFn: () =>
      api<{ minutes: Minutes | null; access: { body: boolean; summary: boolean } }>(
        `/api/meetings/${meetingId}/minutes`,
      ),
  });

  const { data: topicsData } = useQuery({
    queryKey: ["topics", meetingId],
    queryFn: () =>
      api<{ topics: Topic[]; hiddenCount: number }>(`/api/meetings/${meetingId}/topics`).catch(() => null),
    enabled: tab === "topics",
  });

  const minutes = data?.minutes;
  const access = data?.access ?? { body: false, summary: false };
  const status = STATUS_FA[minutes?.status ?? "DRAFT"] ?? STATUS_FA.DRAFT;

  const inv = (key: string) => qc.invalidateQueries({ queryKey: [key, meetingId] });

  const tabs = [
    { id: "summary" as const, label: "خلاصه جلسه", allowed: access.summary },
    { id: "body" as const, label: "متن کامل", allowed: access.body },
    { id: "topics" as const, label: "موضوعات مطرح‌شده", allowed: true },
    { id: "access" as const, label: "دسترسی‌ها", allowed: true },
  ].filter((t) => t.allowed);

  return (
    <Card data-testid="meeting-minutes" data-tour="meeting-minutes">
      <div className="border-b border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <Shield className="h-4 w-4 text-ink-faint" />
            صورت‌جلسه
          </p>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", status.cls)}>
            {status.label}
          </span>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-soft",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "summary" && <SummaryTab meetingId={meetingId} minutes={minutes ?? null} onSaved={() => inv("minutes")} />}
        {tab === "body" && <BodyTab meetingId={meetingId} minutes={minutes ?? null} onSaved={() => inv("minutes")} />}
        {tab === "topics" && (
          <TopicsTab
            meetingId={meetingId}
            topics={topicsData?.topics ?? []}
            hiddenCount={topicsData?.hiddenCount ?? 0}
            onChanged={() => inv("topics")}
          />
        )}
        {tab === "access" && <AccessTab meetingId={meetingId} meId={me?.id} onChanged={() => { inv("minutes"); inv("topics"); }} />}
      </div>
    </Card>
  );
}

/* ─────────────────── خلاصه ─────────────────── */
function SummaryTab({ meetingId, minutes, onSaved }: { meetingId: string; minutes: Minutes | null; onSaved: () => void }) {
  const [text, setText] = useState(minutes?.summary ?? "");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function save() {
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/minutes`, {
        method: "PUT",
        json: { body: minutes?.body || "—", summary: text || null, decisions: [] },
      });
      push("خلاصه ذخیره شد", "success");
      onSaved();
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const locked = minutes?.status === "FINAL";
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        rows={5}
        placeholder="خلاصه‌ای کوتاه از مباحث، نتایج و تصمیمات جلسه…"
        className="w-full rounded-md border border-line p-3 text-[13px] leading-6 outline-none focus:border-ink focus:ring-2 focus:ring-ink/15 disabled:bg-paper-soft"
      />
      {locked ? (
        <p className="text-[11px] text-ink-faint">صورتجلسه نهایی‌شده — قابل ویرایش نیست</p>
      ) : (
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            <Check className="h-4 w-4" />
            {busy ? "در حال ذخیره…" : "ذخیره خلاصه"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── متن کامل ─────────────────── */
function BodyTab({ meetingId, minutes, onSaved }: { meetingId: string; minutes: Minutes | null; onSaved: () => void }) {
  const [text, setText] = useState(minutes?.body ?? "");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function save() {
    setBusy(true);
    try {
      await api(`/api/meetings/${meetingId}/minutes`, {
        method: "PUT",
        json: { body: text, summary: minutes?.summary ?? null, decisions: [] },
      });
      push("متن کامل ذخیره شد", "success");
      onSaved();
    } catch (e) {
      push((e as Error).message || "خطا در ذخیره", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = minutes?.status;
  const locked = status === "FINAL";

  async function transition(action: "submit" | "approve" | "finalize" | "reject") {
    try {
      await api(`/api/meetings/${meetingId}/minutes`, { method: "POST", json: { action } });
      push("وضعیت صورتجلسه به‌روز شد", "success");
      onSaved();
    } catch (e) {
      push((e as Error).message || "خطا", "error");
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        rows={12}
        placeholder="متن کامل صورت‌جلسه — مباحث، بحث‌ها، تصمیمات و اقدامات…"
        className="w-full rounded-md border border-line p-3 text-[13px] leading-7 outline-none focus:border-ink focus:ring-2 focus:ring-ink/15 disabled:bg-paper-soft"
      />
      <p className="text-[11px] text-ink-faint">
        پاراگراف‌ها با Enter جدا می‌شوند؛ ذخیره‌ی خلاصه و متن کامل مستقل از هم است
      </p>
      {locked ? (
        <p className="rounded-md bg-emerald-50 p-2 text-[12px] text-emerald-700">
          این صورتجلسه نهایی شده است
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy || text.trim().length === 0}>
            <Check className="h-4 w-4" />
            ذخیره پیش‌نویس
          </Button>
          {status === "DRAFT" && (
            <Button variant="outline" onClick={() => transition("submit")}>
              <Check className="h-4 w-4" />
              ارسال برای تأیید
            </Button>
          )}
          {status === "PENDING_APPROVAL" && (
            <>
              <Button variant="outline" onClick={() => transition("approve")}>
                <CheckCheck className="h-4 w-4" />
                تأیید
              </Button>
              <Button variant="outline" onClick={() => transition("reject")}>
                <X className="h-4 w-4" />
                بازگشت به پیش‌نویس
              </Button>
            </>
          )}
          {status === "APPROVED" && (
            <Button onClick={() => transition("finalize")}>
              <CheckCheck className="h-4 w-4" />
              نهایی‌سازی
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── موضوعات ─────────────────── */
function TopicsTab({
  meetingId,
  topics,
  hiddenCount,
  onChanged,
}: {
  meetingId: string;
  topics: Topic[];
  hiddenCount: number;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [reviewStatus, setReviewStatus] = useState("COVERED");
  const [notes, setNotes] = useState("");
  const [decisions, setDecisions] = useState("");
  const [restricted, setRestricted] = useState(false);
  const { push } = useToast();

  async function add() {
    if (title.trim().length === 0) return;
    try {
      await api(`/api/meetings/${meetingId}/topics`, {
        method: "POST",
        json: {
          title: title.trim(),
          reviewStatus,
          notes: notes || null,
          decisions: decisions || null,
          visibility: restricted ? "RESTRICTED" : "OPEN",
          allowedUserIds: [],
          sortOrder: topics.length,
        },
      });
      setTitle(""); setNotes(""); setDecisions(""); setAdding(false); setRestricted(false);
      push("موضوع ثبت شد", "success");
      onChanged();
    } catch (e) {
      push((e as Error).message || "خطا", "error");
    }
  }

  async function remove(id: string) {
    if (!confirm("این موضوع حذف شود؟")) return;
    try {
      await api(`/api/meetings/${meetingId}/topics?topicId=${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      push((e as Error).message || "خطا", "error");
    }
  }

  return (
    <div className="space-y-3">
      {hiddenCount > 0 && (
        <p className="flex items-center gap-1.5 rounded-md bg-paper-soft p-2 text-[11px] text-ink-faint">
          <Shield className="h-3 w-3" />
          {faNum(hiddenCount)} موضوع محرمانه برای شما قابل مشاهده نیست
        </p>
      )}
      {topics.length === 0 && !adding && (
        <p className="text-[12px] text-ink-faint">
          هنوز موضوعی ثبت نشده — پس از برگزاری جلسه، موضوعات مطرح‌شده را این‌جا ثبت کنید
        </p>
      )}
      <div className="space-y-2">
        {topics.map((t) => (
          <div key={t.id} className="rounded-lg border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                {t.visibility === "RESTRICTED" && <Shield className="h-3 w-3 shrink-0 text-ink-faint" />}
                <span className="truncate">{t.title}</span>
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    t.reviewStatus === "COVERED" && "bg-emerald-50 text-emerald-700",
                    t.reviewStatus === "PARTIAL" && "bg-amber-50 text-amber-700",
                    t.reviewStatus === "SKIPPED" && "bg-gray-100 text-gray-500",
                  )}
                >
                  {REVIEW_FA[t.reviewStatus]}
                </span>
                <button onClick={() => remove(t.id)} aria-label="حذف موضوع" className="text-ink-faint hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {t.notes && <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-6 text-ink-soft">{t.notes}</p>}
            {t.decisions && (
              <p className="mt-1.5 rounded-md bg-paper-soft p-2 text-[12px] text-ink-soft">
                <span className="font-medium">تصمیم: </span>
                {t.decisions}
              </p>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-lg border border-dashed border-line p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان موضوع مطرح‌شده"
            className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px]">وضعیت بررسی</label>
              <Select
                value={reviewStatus}
                onChange={(v) => setReviewStatus(v)}
                options={Object.entries(REVIEW_FA).map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-[12px]">
              <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="h-4 w-4 accent-black" />
              موضوع محرمانه (فقط افراد مجاز)
            </label>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="نتیجه بحث (اختیاری)" className="w-full rounded-md border border-line p-2 text-[12px] outline-none focus:border-ink" />
          <textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={2} placeholder="تصمیمات اتخاذشده (اختیاری)" className="w-full rounded-md border border-line p-2 text-[12px] outline-none focus:border-ink" />
          <div className="flex justify-end gap-2">
            <Button onClick={add}>ثبت موضوع</Button>
            <Button variant="outline" onClick={() => setAdding(false)}>انصراف</Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-ink-soft hover:bg-paper-soft"
        >
          <Plus className="h-3.5 w-3.5" />
          افزودن موضوع مطرح‌شده
        </button>
      )}
    </div>
  );
}

/* ─────────────────── دسترسی‌ها ─────────────────── */
function AccessTab({ meetingId, onChanged }: { meetingId: string; onChanged: () => void; meId?: string }) {
  const { push } = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ["access", meetingId],
    queryFn: () => api<Access>(`/api/meetings/${meetingId}/access`),
    retry: false,
  });

  if (isLoading) return <p className="text-[12px] text-ink-faint">…</p>;
  if (error) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
        <ShieldCheck className="h-3.5 w-3.5" />
        مدیریت دسترسی مخصوص برگزارکننده جلسه است
      </p>
    );
  }

  async function setLevel(section: string, level: string) {
    try {
      await api(`/api/meetings/${meetingId}/access`, {
        method: "PUT",
        json: { section, level, allowedUserIds: [] },
      });
      push("سطح دسترسی به‌روز شد", "success");
      onChanged();
    } catch (e) {
      push((e as Error).message || "خطا", "error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink-soft">
        سطح محرمانگی هر بخش را تعیین کنید — تغییرات بلافاصله برای همه اعمال می‌شود
      </p>
      <div className="space-y-2">
        {(data?.acls ?? []).map((a) => (
          <div key={a.section} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
            <p className="text-[13px] font-medium">{a.sectionFa}</p>
            <div className="w-56">
              <Select
                value={a.level}
                onChange={(v) => setLevel(a.section, v)}
                options={[
                  { value: "ALL_PARTICIPANTS", label: "همه شرکت‌کنندگان" },
                  { value: "RESTRICTED", label: "افراد منتخب" },
                  { value: "ORGANIZER_ONLY", label: "فقط برگزارکننده" },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
      {(data?.secretaries ?? []).length > 0 && (
        <p className="text-[11px] text-ink-faint">
          دبیران جلسه: {(data?.secretaries ?? []).map((s) => s.fullName).join("، ")}
        </p>
      )}
    </div>
  );
}
