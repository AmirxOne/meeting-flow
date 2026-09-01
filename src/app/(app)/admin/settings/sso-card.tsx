"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { faNum } from "@/lib";

interface SsoStatus {
  authModeHasSso: boolean;
  credentialsConfigured: boolean;
  tenant: string | null;
  clientIdHint: string | null;
  issuer: string | null;
  callbackUrl: string;
  enabled: boolean;
  buttonLabel: string;
  groupRoleMap: Array<{ group: string; roleKey: string }>;
  envMapCount: number;
  roles: Array<{ key: string; name: string }>;
  loginEnabled: boolean;
}

export function SsoSettingsCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [buttonLabel, setButtonLabel] = useState("ورود با حساب سازمانی");
  const [rows, setRows] = useState<Array<{ group: string; roleKey: string }>>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sso"],
    queryFn: () => api<SsoStatus>("/api/admin/sso"),
  });

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setButtonLabel(data.buttonLabel);
    setRows(data.groupRoleMap.length ? data.groupRoleMap : []);
  }, [data]);

  const roleOptions = (data?.roles ?? []).map((r) => ({
    value: r.key,
    label: `${r.name} (${r.key})`,
  }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/sso", {
        method: "PATCH",
        json: {
          enabled,
          buttonLabel: buttonLabel.trim(),
          groupRoleMap: rows.filter((r) => r.group.trim() && r.roleKey.trim()),
        },
      });
      push("تنظیمات ورود سازمانی ذخیره شد", "success");
      qc.invalidateQueries({ queryKey: ["admin-sso"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour="sso-settings" data-testid="sso-settings-card">
      <CardHeader
        title="ورود سازمانی (SSO / OIDC)"
        subtitle="مرورگر با Microsoft Entra ID — رمز LDAP جدا است"
      />
      <CardBody className="space-y-4">
        {isLoading || !data ? (
          <SkeletonBlock className="h-32 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              برای فعال‌سازی، در env مقدار <span dir="ltr">AUTH_MODE=local,sso</span> و کلیدهای
              {" "}
              <span dir="ltr">OIDC_CLIENT_ID / OIDC_CLIENT_SECRET / OIDC_TENANT</span>
              {" "}
              را بگذارید. راز کلاینت فقط در env می‌ماند.
            </p>

            <ul className="space-y-1.5 rounded-md bg-paper-soft px-3 py-3 text-[12px] text-ink-soft">
              <li>
                AUTH_MODE شامل sso:{" "}
                <strong className="text-ink">{data.authModeHasSso ? "بله" : "خیر"}</strong>
              </li>
              <li>
                اعتبارنامه OIDC:{" "}
                <strong className="text-ink">{data.credentialsConfigured ? "ثبت شده" : "ناقص"}</strong>
              </li>
              {data.tenant && (
                <li dir="ltr" className="text-left">
                  tenant: {data.tenant}
                </li>
              )}
              {data.clientIdHint && (
                <li dir="ltr" className="text-left">
                  client: {data.clientIdHint}
                </li>
              )}
              <li>
                Redirect URI (در Entra ثبت کنید):
                <input
                  readOnly
                  dir="ltr"
                  value={data.callbackUrl}
                  className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-left text-[11px] text-ink"
                />
              </li>
              <li>
                دکمه در صفحهٔ ورود:{" "}
                <strong className="text-ink">{data.loginEnabled ? "نمایش داده می‌شود" : "مخفی"}</strong>
              </li>
            </ul>

            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span>نمایش دکمهٔ SSO (اگر env آماده باشد)</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                data-testid="sso-enabled-toggle"
                onClick={() => setEnabled((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  enabled ? "bg-ink" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    enabled ? "start-0.5" : "start-5"
                  }`}
                />
              </button>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink-soft">متن دکمه در صفحهٔ ورود</span>
              <input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-ink-soft">
                  نگاشت گروه Entra به نقش مهرسا ({faNum(rows.length)})
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRows((r) => [...r, { group: "", roleKey: roleOptions[0]?.value ?? "EMPLOYEE" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن
                </Button>
              </div>
              <p className="mb-2 text-[11px] leading-5 text-ink-faint">
                شناسهٔ Object ID گروه یا نام نمایشی. اگر هیچ گروهی مچ نشود، کاربر جدید نقش کارمند می‌گیرد و نقش
                کاربران فعلی عوض نمی‌شود.
              </p>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      dir="ltr"
                      value={row.group}
                      onChange={(e) =>
                        setRows((all) => all.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))
                      }
                      placeholder="group object id / name"
                      className="h-10 min-w-[10rem] flex-1 rounded-md border border-line px-3 text-left text-[12px] outline-none focus:border-ink"
                    />
                    <div className="min-w-[11rem] flex-1">
                      <Select
                        size="sm"
                        value={row.roleKey}
                        onChange={(v) =>
                          setRows((all) => all.map((x, j) => (j === i ? { ...x, roleKey: v } : x)))
                        }
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
                  <p className="text-[12px] text-ink-faint">هنوز نگاشتی نیست — همهٔ کاربران جدید کارمند می‌شوند.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={save} loading={busy} data-testid="sso-settings-save">
                <Building2 className="h-4 w-4" />
                ذخیره SSO
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
