"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
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

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">آدرس لوگو (URL)</span>
              <input
                dir="ltr"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper-soft/40 p-3.5">
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold">نمایشگر تبلت کنار در</p>
              <p className="mt-0.5 text-[11px] leading-5 text-ink-faint">
                برد اطلاعاتی جلسات که روی تبلتِ کنار در هر اتاق نمایش داده می‌شود — با خاموش کردن، همه‌ی نمایشگرها پیام «غیرفعال» می‌بینند
              </p>
            </div>
            <DoorDisplayToggle initial={org.displayEnabled} />
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


/** Instant on/off switch for door-tablet display boards. */
function DoorDisplayToggle({ initial }: { initial: boolean }) {
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
        json: { displayEnabled: next },
      });
      push(next ? "نمایشگر اتاق‌ها فعال شد" : "نمایشگر اتاق‌ها غیرفعال شد", "success");
      qc.invalidateQueries({ queryKey: ["organization"] });
    } catch (e) {
      setOn(!next); // revert
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="نمایشگر تبلت کنار در"
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
  );
}
