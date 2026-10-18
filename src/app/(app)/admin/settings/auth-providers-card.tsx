"use client";

/**
 * کارت واحد «روش‌های ورود» — دو روش:
 *   ۱) رمز محلی (همیشه فعال — فقط توضیح)
 *   ۲) LDAP / Active Directory (فرم کامل + تست اتصال + ذخیره در DB این سازمان)
 * هر روش یک ردیف قابل باز/بسته‌شدن است؛ وضعیت لحظه‌ای در هدر همان ردیف دیده می‌شود.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { ChevronDown, KeyRound, ShieldCheck, Users, Building2 } from "@/components/ui/icon";

/* ── سوییچ inline — هم‌سبک با بقیه‌ی تنظیمات ── */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-ink" : "bg-[#d9d9e0]")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "right-0.5" : "right-[22px]")} />
    </button>
  );
}

/* ── هدر بخش آکاردئونی: آیکون + عنوان + وضعیت + چخم ── */
function Row({
  icon, title, hint, on, open, onToggleOpen, children, testId,
}: {
  icon: React.ReactNode; title: string; hint: string;
  on: boolean | null; // null = بدون سوییچ (محلی)
  open: boolean; onToggleOpen: () => void; children: React.ReactNode; testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn("rounded-lg transition-colors", open && "bg-paper-soft/40")}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
      >
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", on === false ? "bg-paper-soft text-ink-faint" : on ? "bg-emerald-50 text-emerald-600" : "bg-ink/5 text-ink-soft")}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[13px] font-bold">{title}</span>
            {on !== null && (
              <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold", on ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint ring-1 ring-line")}>
                {on ? "فعال" : "غیرفعال"}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-5 text-ink-faint">{hint}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line/70 px-4 pb-4 pt-3.5">{children}</div>}
    </div>
  );
}

/* ── تایپ‌ها ── */
interface LdapForm {
  enabled: boolean; url: string; baseDn: string; bindDn: string;
  userFilter: string; tlsRejectUnauthorized: boolean; autoProvision: boolean;
  hasPassword: boolean; source: "db" | "env" | "none";
}
const EMPTY_LDAP: LdapForm = {
  enabled: false, url: "", baseDn: "", bindDn: "",
  userFilter: "(mail={{email}})", tlsRejectUnauthorized: true, autoProvision: true,
  hasPassword: false, source: "none",
};

export function AuthProvidersCard() {
  const { push } = useToast();
  const qc = useQueryClient();

  const [openRow, setOpenRow] = useState<"local" | "ldap" | null>("ldap");

  /* ── LDAP ── */
  const [form, setForm] = useState<LdapForm>(EMPTY_LDAP);
  const [bindPassword, setBindPassword] = useState("");
  const [sampleEmail, setSampleEmail] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [dirUsers, setDirUsers] = useState<{ email: string; fullName: string; jobTitle?: string | null }[] | null>(null);

  const ldapQ = useQuery({
    queryKey: ["auth-providers-admin"],
    queryFn: () => api<{ orgLdap: LdapForm | null }>("/api/admin/auth-providers"),
  });
  useEffect(() => { if (ldapQ.data?.orgLdap) setForm({ ...EMPTY_LDAP, ...ldapQ.data.orgLdap }); }, [ldapQ.data]);
  const saveLdapMut = useMutation({
    mutationFn: () => api<{ ldap: LdapForm }>("/api/admin/auth-providers", {
      method: "PUT",
      json: { ...form, bindPassword: bindPassword || undefined },
    }),
    onSuccess: (r) => {
      push(r.ldap.enabled ? "ورود LDAP فعال شد" : "تنظیمات LDAP ذخیره شد (غیرفعال)", "success");
      setBindPassword("");
      qc.invalidateQueries({ queryKey: ["auth-providers-admin"] });
    },
    onError: (e) => push((e as ApiError).message || "ذخیره ناموفق بود", "error"),
  });

  const listUsersMut = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; message?: string; users?: { email: string; fullName: string; jobTitle?: string | null }[]; count?: number }>("/api/admin/auth-providers", {
        method: "POST",
        json: { action: "list-users" },
      }),
    onSuccess: (r) => {
      if (r.ok && r.users) setDirUsers(r.users);
      else { setDirUsers(null); push(r.message || "خواندن دایرکتوری ناموفق بود", "error"); }
    },
    onError: (e) => push((e as ApiError).message || "ناموفق بود", "error"),
  });

  const testMut = useMutation({
    mutationFn: () => api<{ ok: boolean; message: string }>("/api/admin/auth-providers", {
      method: "POST",
      json: {
        action: "test-connection",
        url: form.url, baseDn: form.baseDn, bindDn: form.bindDn,
        bindPassword: bindPassword || undefined,
        userFilter: form.userFilter, tlsRejectUnauthorized: form.tlsRejectUnauthorized,
        sampleEmail: sampleEmail || undefined,
      },
    }),
    onSuccess: (r) => { setTestMsg({ ok: r.ok, message: r.message }); push(r.ok ? "تست موفق" : "تست ناموفق", r.ok ? "success" : "error"); },
    onError: (e) => push((e as ApiError).message || "تست ناموفق بود", "error"),
  });


  const F = ({ k, label, ph }: { k: keyof LdapForm; label: string; ph: string }) => (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-ink-soft">{label}</label>
      <input
        value={String(form[k] ?? "")}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={ph}
        dir="ltr"
        className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none transition-colors focus:border-ink"
      />
    </div>
  );

  return (
    <Card data-tour="auth-methods">
      <CardHeader
        title="روش‌های ورود"
        subtitle="احراز هویت این سازمان — روش‌های فعال در صفحه‌ی ورود دیده می‌شوند"
      />
      <div className="space-y-2 p-4">
        {/* ═══ ۱) رمز محلی ═══ */}
        <Row
          icon={<KeyRound className="h-4.5 w-4.5 h-[18px] w-[18px]" />}
          title="ورود با رمز (محلی)"
          hint="ایمیل یا موبایل + رمز عبور"
          on={null}
          open={openRow === "local"}
          onToggleOpen={() => setOpenRow(openRow === "local" ? null : "local")}
        >
          <p className="rounded-md bg-emerald-50/60 px-3 py-2.5 text-[11.5px] leading-6 text-emerald-800">
            این روش همیشه فعال است و غیرفعال‌شدنی نیست — اگر LDAP یا ورود یکپارچه قطع شوند، کاربران با همان رمز محلی وارد می‌شوند.
          </p>
        </Row>

        {/* ═══ ۲) LDAP ═══ */}
        <Row
          icon={<Building2 className="h-[18px] w-[18px]" />}
          title="ورود سازمانی (LDAP / Active Directory)"
          hint={
            form.enabled
              ? form.url || "فعال"
              : form.source === "db" ? "تنظیم‌شده ولی خاموش — روشنش کنید" : "غیرفعال"
          }
          on={form.enabled}
          open={openRow === "ldap"}
          onToggleOpen={() => setOpenRow(openRow === "ldap" ? null : "ldap")}
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12px] font-bold">ورود با رمز دایرکتوری سازمان</p>
                <p className="mt-0.5 text-[10.5px] text-ink-faint">
                  {form.source === "db" ? "تنظیمات ذخیره‌شده‌ی این سازمان" : form.source === "env" ? "فعلاً از متغیرهای محیطی سرور" : "هنوز تنظیم نشده"}
                  {" · "}<span className={form.hasPassword ? "text-emerald-600" : ""}>رمز سرویس {form.hasPassword ? "ثبت شده" : "ثبت نشده"}</span>
                </p>
              </div>
              <Toggle
                on={form.enabled}
                onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                label="فعال‌سازی LDAP"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <F k="url" label="آدرس سرور *" ph="ldap://192.168.1.10:389" />
              <F k="baseDn" label="Base DN *" ph="dc=company,dc=local" />
              <F k="bindDn" label="Bind DN (حساب سرویس) *" ph="cn=svc-mehrsa,ou=Service,dc=company,dc=local" />
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-soft">
                  رمز سرویس {form.hasPassword ? "(ثبت شده — خالی = دست‌نخورده)" : "*"}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  name="ldap-bind-secret"
                  value={bindPassword}
                  onChange={(e) => setBindPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none transition-colors focus:border-ink"
                />
              </div>
              <F k="userFilter" label="فیلتر جست‌وجوی کاربر" ph="(mail={{email}})" />
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2.5">
                  <span className="text-[11.5px]">اعتبارسنجی گواهی TLS</span>
                  <Toggle on={form.tlsRejectUnauthorized} onChange={(v) => setForm((f) => ({ ...f, tlsRejectUnauthorized: v }))} label="اعتبارسنجی گواهی TLS" />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2.5">
                  <span className="text-[11.5px]">ساخت خودکار کاربر در اولین ورود</span>
                  <Toggle on={form.autoProvision} onChange={(v) => setForm((f) => ({ ...f, autoProvision: v }))} label="ساخت خودکار کاربر" />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[180px] flex-1">
                <input
                  value={sampleEmail}
                  onChange={(e) => setSampleEmail(e.target.value)}
                  placeholder="ایمیل نمونه برای تست جست‌وجو (اختیاری)"
                  dir="ltr"
                  className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none focus:border-ink"
                />
              </div>
              <Button size="sm" variant="outline" loading={testMut.isPending} onClick={() => testMut.mutate()}>
                <ShieldCheck className="h-3.5 w-3.5" />
                تست اتصال
              </Button>
              <Button size="sm" variant="outline" loading={listUsersMut.isPending} onClick={() => { setDirUsers(null); listUsersMut.mutate(); }}>
                <Users className="h-3.5 w-3.5" />
                کاربران دایرکتوری
              </Button>
              <Button
                size="sm"
                loading={saveLdapMut.isPending}
                onClick={() => saveLdapMut.mutate()}
                disabled={form.enabled && (!form.url || !form.baseDn || !form.bindDn || (!form.hasPassword && !bindPassword))}
              >
                ذخیره LDAP
              </Button>
            </div>
            {testMsg && (
              <p className={cn("rounded-md px-2.5 py-2 text-[11.5px]", testMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                {testMsg.message}
              </p>
            )}
            {dirUsers && (
              <div className="rounded-md border border-line bg-white">
                <p className="border-b border-line px-3 py-2 text-[11.5px] font-bold">
                  {faNum(dirUsers.length)} کاربر در دایرکتوری
                </p>
                <div className="max-h-52 overflow-y-auto divide-y divide-line/70">
                  {dirUsers.map((u) => (
                    <div key={u.email} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{u.fullName}</p>
                        <p dir="ltr" className="truncate text-left text-[10.5px] text-ink-faint">{u.email}</p>
                      </div>
                      {u.jobTitle && (
                        <span className="shrink-0 rounded-full bg-paper-soft px-2 py-0.5 text-[10px] text-ink-soft" dir="ltr">{u.jobTitle}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] leading-5 text-ink-faint">
              رمز سرویس با AES-256-GCM رمزگذاری و ذخیره می‌شود و هرگز نمایش داده نمی‌شود. هر سازمان فقط تنظیمات خودش را می‌بیند.
            </p>
          </div>
        </Row>

      </div>
    </Card>
  );
}
