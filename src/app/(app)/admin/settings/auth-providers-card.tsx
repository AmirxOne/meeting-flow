"use client";

/**
 * کارت واحد «روش‌های ورود» — سه روش در یک‌جا:
 *   ۱) رمز محلی (همیشه فعال — فقط توضیح)
 *   ۲) LDAP / Active Directory (فرم کامل + تست اتصال + ذخیره در DB این سازمان)
 *   ۳) SSO / OIDC (وضعیت env + دکمه‌ی ورود + نگاشت نقش‌ها)
 * هر روش یک ردیف قابل باز/بسته‌شدن است؛ وضعیت لحظه‌ای در هدر همان ردیف دیده می‌شود.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn, faNum } from "@/lib";
import { ChevronDown, KeyRound, ShieldCheck, User, Plus, Trash2, Building2 } from "@/components/ui/icon";

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
interface SsoStatus {
  authModeHasSso: boolean; credentialsConfigured: boolean;
  tenant: string | null; clientIdHint: string | null; callbackUrl: string;
  enabled: boolean; buttonLabel: string;
  groupRoleMap: Array<{ group: string; roleKey: string }>;
  roles: Array<{ key: string; name: string }>;
  loginEnabled: boolean;
}

const EMPTY_LDAP: LdapForm = {
  enabled: false, url: "", baseDn: "", bindDn: "",
  userFilter: "(mail={{email}})", tlsRejectUnauthorized: true, autoProvision: true,
  hasPassword: false, source: "none",
};

export function AuthProvidersCard() {
  const { push } = useToast();
  const qc = useQueryClient();

  const [openRow, setOpenRow] = useState<"local" | "ldap" | "sso" | null>("ldap");

  /* ── LDAP ── */
  const [form, setForm] = useState<LdapForm>(EMPTY_LDAP);
  const [bindPassword, setBindPassword] = useState("");
  const [sampleEmail, setSampleEmail] = useState("");
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);

  /* ── SSO ── */
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [buttonLabel, setButtonLabel] = useState("ورود با حساب سازمانی");
  const [rows, setRows] = useState<Array<{ group: string; roleKey: string }>>([]);
  const [ssoBusy, setSsoBusy] = useState(false);

  const ldapQ = useQuery({
    queryKey: ["auth-providers-admin"],
    queryFn: () => api<{ orgLdap: LdapForm | null }>("/api/admin/auth-providers"),
  });
  const ssoQ = useQuery({
    queryKey: ["admin-sso"],
    queryFn: () => api<SsoStatus>("/api/admin/sso"),
  });

  useEffect(() => { if (ldapQ.data?.orgLdap) setForm({ ...EMPTY_LDAP, ...ldapQ.data.orgLdap }); }, [ldapQ.data]);
  useEffect(() => {
    const d = ssoQ.data;
    if (!d) return;
    setSsoEnabled(d.enabled); setButtonLabel(d.buttonLabel); setRows(d.groupRoleMap);
  }, [ssoQ.data]);

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

  async function saveSso() {
    setSsoBusy(true);
    try {
      await api("/api/admin/sso", {
        method: "PATCH",
        json: { enabled: ssoEnabled, buttonLabel: buttonLabel.trim(), groupRoleMap: rows.filter((r) => r.group.trim() && r.roleKey.trim()) },
      });
      push("تنظیمات ورود یکپارچه ذخیره شد", "success");
      qc.invalidateQueries({ queryKey: ["admin-sso"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setSsoBusy(false);
    }
  }

  const roleOptions = (ssoQ.data?.roles ?? []).map((r) => ({ value: r.key, label: `${r.name} (${r.key})` }));
  const sso = ssoQ.data;
  const ssoReady = !!sso?.authModeHasSso && !!sso?.credentialsConfigured;

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
    <Card data-tour="sso-settings">
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
            <p className="text-[10px] leading-5 text-ink-faint">
              رمز سرویس با AES-256-GCM رمزگذاری و ذخیره می‌شود و هرگز نمایش داده نمی‌شود. هر سازمان فقط تنظیمات خودش را می‌بیند.
            </p>
          </div>
        </Row>

        {/* ═══ ۳) SSO ═══ */}
        <Row
          icon={<User className="h-[18px] w-[18px]" />}
          title="ورود یکپارچه (SSO / Microsoft Entra ID)"
          hint={
            ssoReady
              ? (sso?.loginEnabled ? "دکمه‌ی ورود در صفحه‌ی لاگین نمایش داده می‌شود" : "آماده ولی دکمه مخفی است")
              : "نیازمند تنظیم env سرور"
          }
          on={ssoReady ? (sso?.loginEnabled ?? false) : false}
          open={openRow === "sso"}
          onToggleOpen={() => setOpenRow(openRow === "sso" ? null : "sso")}
          testId="sso-settings-card"
        >
          {!ssoReady && (
            <div className="mb-3 rounded-md bg-amber-50/70 px-3 py-2.5 text-[11.5px] leading-6 text-amber-800">
              برای فعال‌سازی، در فایل env سرور مقدار <span dir="ltr" className="font-bold">AUTH_MODE=local,sso</span> و کلیدهای{" "}
              <span dir="ltr">OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_TENANT</span> را بگذارید و سرور را ری‌استارت کنید.
              راز کلاینت فقط در env می‌ماند و به دیتابیس نمی‌آید.
            </div>
          )}
          <div className="space-y-3.5">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["AUTH_MODE شامل sso", sso?.authModeHasSso],
                ["اعتبارنامه OIDC", sso?.credentialsConfigured],
                ["دکمه‌ی صفحه‌ی ورود", sso?.loginEnabled],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2">
                  <span className="text-[11px] text-ink-soft">{k as string}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-bold", v ? "bg-emerald-50 text-emerald-700" : "bg-paper-soft text-ink-faint ring-1 ring-line")}>
                    {v ? "✓" : "خیر"}
                  </span>
                </div>
              ))}
            </div>

            {sso?.tenant && (
              <p dir="ltr" className="text-left text-[11px] text-ink-faint">tenant: {sso.tenant}{sso.clientIdHint ? ` · client: ${sso.clientIdHint}` : ""}</p>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Redirect URI — این آدرس را در Entra ثبت کنید</label>
              <input
                readOnly
                dir="ltr"
                value={sso?.callbackUrl ?? ""}
                className="h-10 w-full rounded-md border border-line bg-paper-soft/60 px-3 text-left text-[11.5px] text-ink"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[12px] font-bold">نمایش دکمه‌ی SSO</span>
                <span className="mt-0.5 block text-[10.5px] text-ink-faint">فقط وقتی env آماده باشد اثر دارد</span>
              </span>
              <Toggle on={ssoEnabled} onChange={setSsoEnabled} label="نمایش دکمه SSO" />
            </label>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-soft">متن دکمه در صفحه‌ی ورود</label>
              <input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-white px-3 text-[12px] outline-none focus:border-ink"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-ink-soft">نگاشت گروه Entra به نقش ({faNum(rows.length)})</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { group: "", roleKey: roleOptions[0]?.value ?? "EMPLOYEE" }])}>
                  <Plus className="h-3.5 w-3.5" />
                  افزودن
                </Button>
              </div>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      dir="ltr"
                      value={row.group}
                      onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))}
                      placeholder="group object id / name"
                      className="h-10 min-w-[10rem] flex-1 rounded-md border border-line bg-white px-3 text-left text-[12px] outline-none focus:border-ink"
                    />
                    <div className="min-w-[11rem] flex-1">
                      <Select
                        size="sm"
                        value={row.roleKey}
                        onChange={(v) => setRows((all) => all.map((x, j) => (j === i ? { ...x, roleKey: v } : x)))}
                        options={roleOptions.length ? roleOptions : [{ value: "EMPLOYEE", label: "کارمند" }]}
                      />
                    </div>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-md text-ink-soft hover:bg-red-50 hover:text-red-600"
                      onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                      aria-label="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="text-[11px] leading-5 text-ink-faint">
                    اگر هیچ گروهی مچ نشود، کاربر جدید نقش «کارمند» می‌گیرد و نقش کاربران فعلی عوض نمی‌شود.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveSso} loading={ssoBusy} data-testid="sso-settings-save">
                ذخیره SSO
              </Button>
            </div>
          </div>
        </Row>
      </div>
    </Card>
  );
}
