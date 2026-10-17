"use client";

/**
 * کارت «روش‌های ورود» — پنل مدیریت احراز هویت.
 * وضعیت Local/LDAP/SSO + تست اتصال LDAP (تنظیمات از env — بخش غیرحساس نمایش داده می‌شود).
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { Check, X, ShieldCheck, Loader2 } from "@/components/ui/icon";

interface ProviderInfo { id: string; label: string; enabled: boolean }
interface LdapInfo { url: string; baseDn: string; bindDn: string; userFilter: string; tlsRejectUnauthorized: boolean }

export function AuthProvidersCard() {
  const { push } = useToast();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [sampleEmail, setSampleEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["auth-providers-admin"],
    queryFn: () => api<{ providers: ProviderInfo[]; ldap: LdapInfo | null; source: string }>("/api/admin/auth-providers"),
  });

  const testMut = useMutation({
    mutationFn: (withSearch: boolean) =>
      api<{ ok: boolean; message: string }>("/api/admin/auth-providers", {
        method: "POST",
        json: withSearch && sampleEmail ? { action: "test-connection", sampleEmail } : { action: "test-connection" },
      }),
    onSuccess: (r) => {
      setTestMsg(r.message);
      push(r.ok ? "تست موفق" : "تست ناموفق", r.ok ? "success" : "error");
    },
    onError: (e) => push((e as ApiError).message || "تست ناموفق بود", "error"),
  });

  const providers = data?.providers ?? [];
  const ldap = data?.ldap ?? null;

  return (
    <Card>
      <CardHeader
        title="روش‌های ورود"
        subtitle="وضعیت احراز هویت سازمان — روش محلی همیشه فعال است؛ LDAP اختیاری و از متغیرهای محیطی تنظیم می‌شود"
      />
      <div className="divide-y divide-line">
        {isLoading ? (
          <div className="p-4"><div className="skeleton h-10 w-full rounded-md" /></div>
        ) : (
          providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", p.enabled ? "bg-emerald-50 text-emerald-600" : "bg-paper-soft text-ink-faint")}>
                  {p.enabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{p.label}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-faint">
                    {p.id === "local" && "ورود با ایمیل/موبایل و رمز — پیش‌فرض همه‌ی نصب‌ها"}
                    {p.id === "ldap" && (p.enabled ? "اتصال به دایرکتوری سازمانی فعال است" : "غیرفعال — با AUTH_MODE=ldap و تنظیمات LDAP فعال می‌شود")}
                    {p.id === "sso" && (p.enabled ? "پیکربندی OIDC موجود است" : "تنظیم نشده — برای آینده آماده است")}
                  </p>
                </div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold", p.enabled ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint")}>
                {p.enabled ? "فعال" : "غیرفعال"}
              </span>
            </div>
          ))
        )}

        {/* جزئیات LDAP */}
        {ldap && (
          <div className="space-y-2.5 px-5 py-4">
            <p className="text-[12px] font-bold">تنظیمات LDAP (از متغیرهای محیطی)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["آدرس سرور", ldap.url],
                ["Base DN", ldap.baseDn],
                ["Bind DN", ldap.bindDn],
                ["فیلتر جست‌وجو", ldap.userFilter],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-line bg-paper-soft/40 px-2.5 py-2">
                  <p className="text-[10px] text-ink-faint">{k}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium" dir="ltr">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="min-w-[200px] flex-1">
                <input
                  value={sampleEmail}
                  onChange={(e) => setSampleEmail(e.target.value)}
                  placeholder="ایمیل نمونه برای تست جست‌وجو (اختیاری)"
                  dir="ltr"
                  className="h-9 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none focus:border-ink"
                />
              </div>
              <Button size="sm" variant="outline" loading={testMut.isPending} onClick={() => testMut.mutate(true)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                تست اتصال
              </Button>
            </div>
            {testMsg && (
              <p className={cn("rounded-md px-2.5 py-2 text-[11.5px]", testMut.data?.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                {testMsg}
              </p>
            )}
            <p className="text-[10px] leading-5 text-ink-faint">
              رمز سرویس LDAP فقط در متغیر محیطی LDAP_BIND_PASSWORD نگه‌داری می‌شود و هرگز نمایش/انتقال نمی‌یابد.
              برای تغییر تنظیمات، متغیرهای LDAP_* را در پیکربندی سرور به‌روز کنید.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
