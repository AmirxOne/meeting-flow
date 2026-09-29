"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { invalidateOrgBranding } from "@/lib/org-branding";
import { Card, CardHeader, CardBody, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { formatJalali } from "@/lib";
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
      invalidateOrgBranding(); // عنوان تب و همه‌ی استفاده‌های نام سازمان تازه شود
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

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-bold">تنظیمات سازمان</h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          نام، منطقه زمانی، ورود سازمانی (SSO) و پایلوت پیامک — آخرین به‌روزرسانی: {formatJalali(new Date(org.updatedAt))}
        </p>
      </div>

      <Card>
        <CardHeader title="مشخصات سازمان" subtitle="تغییرات در لاگ ممیزی ثبت می‌شود" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">نام نمایشی *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="نام سازمان"
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">نام حقوقی</span>
              <input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="نام ثبت‌شده / حقوقی"
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">منطقه زمانی</span>
              <Select
                value={form.timezone}
                onChange={(v) => setForm({ ...form, timezone: v })}
                options={TIMEZONE_OPTIONS}
              />
            </label>

            <div className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">لوگوی سازمان</span>
              <OrgLogoUploader
                initial={org.logoUrl}
                onChanged={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              />
            </div>
          </div>

          {/* امکانات جانبی — کنترل مرکزی ادمین */}
          <div className="rounded-lg border border-line bg-paper-soft/40">
            <div className="border-b border-line px-3.5 py-3">
              <p className="text-[13px] font-bold">امکانات جانبی</p>
              <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">
                فعال/غیرفعال‌سازی مرکزی — همه‌ی بخش‌های سامانه از این‌جا دستور می‌گیرند. پیش‌فرض همه خاموش است.
              </p>
            </div>
            <div className="divide-y divide-line">
              <FeatureToggleRow
                title="حضور و غیاب"
                desc="ثبت حاضرین جلسه در صفحه‌ی جزئیات جلسه"
                field="attendanceEnabled"
                initial={org.attendanceEnabled}
              />
              <FeatureToggleRow
                title="نمایشگر تبلت کنار در"
                desc="برد اطلاعاتی جلسات که روی تبلتِ کنار در هر اتاق نمایش داده می‌شود — با خاموش کردن، همه‌ی نمایشگرها پیام «غیرفعال» می‌بینند"
                field="displayEnabled"
                initial={org.displayEnabled}
              />
              <FeatureToggleRow
                title="QR Code اتاق جلسه"
                desc="دانلود پوستر QR و چک‌این مهمان‌ها با اسکن — در صفحه‌ی جزئیات اتاق و جلسه"
                field="qrCheckinEnabled"
                initial={org.qrCheckinEnabled}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2}>
              ذخیره تغییرات
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* integrations & ops — two-column on wide screens */}
      <div className="grid gap-4 items-start lg:grid-cols-2">
        <WorkerStatusCard />
        <SmsPilotCard />
        <EmailPilotCard />
      </div>

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
    <div className="flex items-center gap-3">
      {/* پیش‌نمایش */}
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper-soft">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={isLocal ? "/api/public/organization/logo" : logoUrl} alt="لوگو" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[10px] text-ink-faint">بدون لوگو</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
            {logoUrl ? "تغییر لوگو" : "آپلود لوگو"}
          </Button>
          {logoUrl && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>
              حذف
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10.5px] leading-4 text-ink-faint">
          PNG، JPG، WebP، GIF یا SVG — سقف ۲ مگابایت — در سربرگ، صفحه‌ی لاگین و صفحه‌های عمومی اعمال می‌شود
        </p>
      </div>
    </div>
  );
}

/** سوییچ آنی برای امکانات جانبی — ذخیره‌ی فوری و مرکزی */
function FeatureToggleRow({
  title,
  desc,
  field,
  initial,
}: {
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
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">{desc}</p>
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
