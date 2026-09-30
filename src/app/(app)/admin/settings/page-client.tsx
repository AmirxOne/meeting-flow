"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  UserCheck,
  Settings,
  MessageQuestion,
  DoorOpen,
} from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { invalidateOrgBranding } from "@/lib/org-branding";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, formatJalali } from "@/lib";
import { SsoSettingsCard } from "./sso-card";
import { SmsPilotCard } from "./sms-pilot-card";
import { EmailPilotCard } from "./email-pilot-card";
import { WorkerStatusCard } from "./worker-status-card";

interface Organization {
  id: string;
  name: string;
  legalName: string | null;
  timezone: string;
  logoUrl: string | null;
  displayEnabled: boolean;
  attendanceEnabled: boolean;
  qrCheckinEnabled: boolean;
  updatedAt: string;
}

const TIMEZONE_OPTIONS = [
  { value: "Asia/Tehran", label: "تهران (Asia/Tehran)" },
  { value: "Asia/Dubai", label: "دبی (Asia/Dubai)" },
  { value: "Europe/Istanbul", label: "استانبول (Europe/Istanbul)" },
  { value: "UTC", label: "UTC" },
];

export function AdminSettingsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    timezone: "Asia/Tehran",
    logoUrl: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api<{ organization: Organization | null }>("/api/admin/organization"),
    enabled: can("org:manage"),
  });

  useEffect(() => {
    const org = data?.organization;
    if (!org) return;
    setForm({
      name: org.name,
      legalName: org.legalName ?? "",
      timezone: org.timezone || "Asia/Tehran",
      logoUrl: org.logoUrl ?? "",
    });
  }, [data?.organization]);

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/organization", {
        method: "PATCH",
        json: {
          name: form.name.trim(),
          legalName: form.legalName.trim(),
          timezone: form.timezone,
          logoUrl: form.logoUrl.trim(),
        },
      });
      push("اطلاعات سازمان ذخیره شد", "success");
      qc.invalidateQueries({ queryKey: ["organization"] });
      qc.invalidateQueries({ queryKey: ["organization-branding"] });
      invalidateOrgBranding();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!can("org:manage")) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          تنظیمات سازمان نیازمند دسترسی org:manage است.
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-7 w-40" />
        <Card>
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <div className="space-y-4 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const org = data?.organization;

  if (!org) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Card>
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="سازمانی ثبت نشده"
            description="رکورد Organization در پایگاه داده یافت نشد — seed را اجرا کنید."
          />
        </Card>
      </div>
    );
  }

  const inputCls = "h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/10";
  const dirty =
    form.name.trim() !== org.name ||
    form.legalName.trim() !== (org.legalName ?? "") ||
    form.timezone !== org.timezone ||
    form.logoUrl.trim() !== (org.logoUrl ?? "");

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* ── هدر ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-ink text-white">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-6">تنظیمات سازمان</h1>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              پروفایل، برندینگ، امکانات و یکپارچه‌سازی‌ها در یک نگاه
            </p>
          </div>
        </div>
        <span className="rounded-full bg-paper-soft px-3 py-1 text-[11px] text-ink-faint ring-1 ring-line">
          آخرین به‌روزرسانی: {formatJalali(new Date(org.updatedAt))}
        </span>
      </div>

      {/* ── ردیف ۱: هویت + امکانات ── */}
      <div className="grid items-start gap-4 xl:grid-cols-5">
        {/* هویت و برندینگ */}
        <Card className="xl:col-span-3">
          <CardHeader title="هویت و برندینگ" subtitle="نام سازمان، لوگو و منطقه‌ی زمانی — در سراسر سامانه اعمال می‌شود" />
          <CardBody className="space-y-4">
            {/* لوگو — ردیف برجسته */}
            <div className="rounded-xl border border-line bg-paper-soft/40 p-4">
              <OrgLogoUploader
                initial={org.logoUrl}
                onChanged={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-ink-soft">نام نمایشی *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="نام سازمان"
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-ink-soft">نام حقوقی</span>
                <input
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="نام ثبت‌شده / حقوقی"
                  className={inputCls}
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">منطقه زمانی</span>
              <Select
                value={form.timezone}
                onChange={(v) => setForm({ ...form, timezone: v })}
                options={TIMEZONE_OPTIONS}
              />
            </label>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className={cn("text-[11px]", dirty ? "font-medium text-amber-600" : "text-ink-faint")}>
                {dirty ? "تغییرات ذخیره‌نشده دارید" : "همه‌چیز ذخیره است"}
              </p>
              <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2 || !dirty}>
                ذخیره تغییرات
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* امکانات جانبی */}
        <Card className="xl:col-span-2">
          <CardHeader title="امکانات جانبی" subtitle="کنترل مرکزی — همه‌ی بخش‌ها از این‌جا دستور می‌گیرند" />
          <div className="divide-y divide-line">
            <FeatureToggleRow
              icon={<UserCheck className="h-4 w-4" />}
              title="حضور و غیاب"
              desc="ثبت حاضرین جلسه در صفحه‌ی جزئیات جلسه"
              field="attendanceEnabled"
              initial={org.attendanceEnabled}
            />
            <FeatureToggleRow
              icon={<DoorOpen className="h-4 w-4" />}
              title="نمایشگر تبلت کنار در"
              desc="برد اطلاعاتی جلسات روی تبلتِ کنار در هر اتاق"
              field="displayEnabled"
              initial={org.displayEnabled}
            />
            <FeatureToggleRow
              icon={<MessageQuestion className="h-4 w-4" />}
              title="QR Code اتاق جلسه"
              desc="پوستر QR و چک‌این مهمان‌ها با اسکن"
              field="qrCheckinEnabled"
              initial={org.qrCheckinEnabled}
            />
          </div>
          <div className="border-t border-line bg-paper-soft/40 px-5 py-3">
            <p className="text-[11px] leading-5 text-ink-faint">
              تغییرات بی‌درنگ اعمال می‌شود و نیازی به «ذخیره» ندارد. پیش‌فرض همه خاموش است.
            </p>
          </div>
        </Card>
      </div>

      {/* ── ردیف ۲: زیرساخت و پیام‌رسانی ── */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <WorkerStatusCard />
        <SmsPilotCard />
        <EmailPilotCard />
      </div>

      {/* ── ردیف ۳: امنیت ── */}
      <SsoSettingsCard />
    </div>
  );
}

/** آپلودر لوگوی سازمان — انتخاب فایل با قواعد (فقط تصویر، سقف ۲MB) + پیش‌نمایش + حذف */
function OrgLogoUploader({ initial, onChanged }: { initial: string | null; onChanged: (url: string) => void }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      push("حجم لوگو حداکثر ۲ مگابایت است", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/organization/logo", { method: "POST", body: fd, credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message || "خطا در آپلود لوگو");
      setLogoUrl(payload.data.logoUrl);
      onChanged(payload.data.logoUrl);
      push("لوگوی سازمان به‌روزرسانی شد", "success");
      qc.invalidateQueries({ queryKey: ["organization"] });
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/admin/organization/logo", { method: "DELETE" });
      setLogoUrl(null);
      onChanged("");
      push("لوگو حذف شد — لوگوی پیش‌فرض نمایش داده می‌شود", "success");
      qc.invalidateQueries({ queryKey: ["organization"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const isLocal = logoUrl?.startsWith("/api/public/organization/logo");

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* پیش‌نمایش بزرگ */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={cn(
          "logo-checkerboard flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          dragOver ? "border-ink" : "border-line hover:border-ink/40",
        )}
        onClick={() => inputRef.current?.click()}
        title="کلیک یا فایل را این‌جا رها کنید"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={isLocal ? "/api/public/organization/logo" : logoUrl} alt="لوگو" className="max-h-full max-w-full object-contain p-1" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-ink-faint">
            {/* لوگوی پیش‌فرض نشان داده می‌شود — سازمان هنوز لوگوی خود را بارگذاری نکرده */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="لوگوی پیش‌فرض" className="max-h-14 max-w-full object-contain" />
            <span className="text-[10px]">پیش‌فرض</span>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <p className="text-[12.5px] font-bold">لوگوی سازمان</p>
        <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">
          PNG، JPG، WebP، GIF یا SVG تا ۲ مگابایت — در سربرگ، صفحه‌ی لاگین، صفحه‌های عمومی و favicon اعمال می‌شود.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-ink-faint">
            {busy ? "در حال بارگذاری…" : logoUrl ? "برای تغییر، روی کادر بزنید یا فایل بیندازید" : "روی کادر بزنید یا فایل را بکشید و رها کنید"}
          </span>
          {logoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="text-[11px] font-medium text-red-600 underline-offset-4 transition-colors hover:underline disabled:opacity-50"
            >
              حذف لوگو
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** سوییچ آنی برای امکانات جانبی — ذخیره‌ی فوری و مرکزی */
function FeatureToggleRow({
  icon,
  title,
  desc,
  field,
  initial,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  field: "attendanceEnabled" | "displayEnabled" | "qrCheckinEnabled";
  initial: boolean;
}) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setBusy(true);
    try {
      await api("/api/admin/organization", {
        method: "PATCH",
        json: { [field]: next },
      });
      push(next ? `«${title}» فعال شد` : `«${title}» غیرفعال شد`, "success");
      qc.invalidateQueries({ queryKey: ["organization"] });
    } catch (e) {
      setOn(!next); // revert
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              on ? "bg-ink text-white" : "bg-paper-soft text-ink-faint ring-1 ring-line",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12.5px] font-bold">
            {title}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9.5px] font-medium",
                on ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint ring-1 ring-line",
              )}
            >
              {on ? "فعال" : "غیرفعال"}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={busy}
        onClick={toggle}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 " +
          (on ? "bg-ink" : "bg-[#d9d9e0]")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
            (on ? "right-0.5" : "right-[calc(100%-1.375rem)]")
          }
        />
      </button>
    </div>
  );
}
