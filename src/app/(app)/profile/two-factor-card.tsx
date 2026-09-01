"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Shield, ShieldCheck } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { faNum, faStr, formatJalali, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib";

const fieldInputClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

type TwoFactorStatus = {
  enabled: boolean;
  enabledAt: string | null;
  pendingSetup: boolean;
};

type SetupPayload = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

export function TwoFactorCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableRecovery, setDisableRecovery] = useState("");
  const [useDisableRecovery, setUseDisableRecovery] = useState(false);
  const [copied, setCopied] = useState<"secret" | "recovery" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["two-factor"],
    queryFn: () => api<TwoFactorStatus>("/api/auth/2fa"),
  });

  const { data: authConfig } = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api<{ authMode: "local" | "ldap" }>("/api/auth/config"),
  });

  async function startSetup() {
    setBusy("setup");
    try {
      const res = await api<SetupPayload>("/api/auth/2fa/setup", { method: "POST" });
      setSetup(res);
      setConfirmCode("");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmEnable() {
    setBusy("enable");
    try {
      const res = await api<{ enabled: boolean; recoveryCodes: string[] }>("/api/auth/2fa/enable", {
        method: "POST",
        json: { code: toEnDigits(stripBidiMarks(confirmCode)) },
      });
      setSetup(null);
      setConfirmCode("");
      setRecoveryCodes(res.recoveryCodes);
      await qc.invalidateQueries({ queryKey: ["two-factor"] });
      push("تأیید دو مرحله‌ای فعال شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDisable() {
    setBusy("disable");
    try {
      await api("/api/auth/2fa/disable", {
        method: "POST",
        json: useDisableRecovery
          ? { recoveryCode: stripBidiMarks(disableRecovery).trim() }
          : { code: toEnDigits(stripBidiMarks(disableCode)) },
      });
      setDisableOpen(false);
      setDisableCode("");
      setDisableRecovery("");
      await qc.invalidateQueries({ queryKey: ["two-factor"] });
      push("تأیید دو مرحله‌ای غیرفعال شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function copyText(kind: "secret" | "recovery", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
    push("کپی شد", "success");
  }

  const enabled = !!data?.enabled;
  const ldapMode = authConfig?.authMode === "ldap";
  const groupedSecret = setup?.secret.match(/.{1,4}/g)?.join(" ") ?? "";

  return (
    <>
      <Card data-tour="two-factor" data-testid="two-factor-card">
        <CardHeader
          title="تأیید دو مرحله‌ای"
          subtitle="کد ۶ رقمی اپ authenticator بعد از رمز عبور"
        />
        <CardBody className="space-y-4">
          {isLoading ? (
            <SkeletonBlock className="h-24 w-full" />
          ) : (
            <>
              <p className="text-[12px] leading-6 text-ink-soft">
                با فعال‌سازی، ورود فقط با رمز کافی نیست — کد یک‌بارمصرف Google Authenticator یا برنامه مشابه لازم است.
                کدهای بازیابی را در جای امن نگه دارید.
              </p>
              <p className="text-[12px] leading-6 text-ink-faint">
                {ldapMode
                  ? "ورود سازمانی (LDAP): پس از bind موفق دایرکتوری، اگر ۲FA فعال باشد همان کد authenticator مهرسا خواسته می‌شود."
                  : "اگر سازمان بعداً ورود LDAP را روشن کند، پس از تأیید رمز دایرکتوری همچنان کد authenticator مهرسا لازم است."}
              </p>

              {enabled ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p
                      data-testid="two-factor-status"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-ink"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      فعال است
                    </p>
                    {data?.enabledAt && (
                      <p className="text-[12px] text-ink-faint">
                        از {formatJalali(new Date(data.enabledAt), { withTime: true })}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    data-testid="two-factor-disable"
                    onClick={() => setDisableOpen(true)}
                  >
                    غیرفعال کردن
                  </Button>
                </div>
              ) : setup ? (
                <div className="space-y-4" data-testid="two-factor-setup">
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={setup.qrDataUrl}
                      alt="QR کد authenticator"
                      width={180}
                      height={180}
                      className="rounded-lg border border-line bg-white p-1"
                      data-testid="two-factor-qr"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[12px] leading-6 text-ink-soft">
                        QR را با اپ authenticator اسکن کنید، یا کلید را دستی وارد کنید.
                      </p>
                      <p
                        dir="ltr"
                        data-testid="two-factor-secret"
                        className="break-all rounded-md bg-paper-soft px-3 py-2 text-left font-mono text-[12px] tracking-wide text-ink"
                      >
                        {groupedSecret}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyText("secret", setup.secret)}
                      >
                        {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied === "secret" ? "کپی شد" : "کپی کلید"}
                      </Button>
                    </div>
                  </div>
                  <label className="block space-y-1.5 text-right" dir="rtl">
                    <span className="block text-[12px] font-medium text-ink-soft">کد ۶ رقمی برای تأیید</span>
                    <input
                      data-testid="two-factor-confirm"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      dir="rtl"
                      value={confirmCode ? withRtlMark(faStr(confirmCode)) : ""}
                      onChange={(e) =>
                        setConfirmCode(
                          toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      className={`${fieldInputClass} tracking-[0.35em]`}
                      placeholder={faStr("000000")}
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSetup(null);
                        setConfirmCode("");
                      }}
                    >
                      انصراف
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid="two-factor-enable"
                      loading={busy === "enable"}
                      disabled={confirmCode.length !== 6}
                      onClick={confirmEnable}
                    >
                      <Shield className="h-4 w-4" />
                      فعال کردن
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p data-testid="two-factor-status" className="text-[13px] text-ink-soft">
                    هنوز فعال نیست
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="two-factor-start"
                    loading={busy === "setup"}
                    onClick={startSetup}
                  >
                    <Shield className="h-4 w-4" />
                    فعال‌سازی
                  </Button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={!!recoveryCodes}
        onClose={() => setRecoveryCodes(null)}
        title="کدهای بازیابی"
        subtitle={`این ${faNum(recoveryCodes?.length ?? 0)} کد را یک‌بار نشان می‌دهیم — در جای امن ذخیره کنید`}
        footer={
          <Button type="button" onClick={() => setRecoveryCodes(null)} data-testid="two-factor-recovery-done">
            ذخیره کردم
          </Button>
        }
      >
        {recoveryCodes && (
          <div className="space-y-3" data-testid="two-factor-recovery-codes">
            <ul className="grid grid-cols-2 gap-2 font-mono text-[13px]" dir="ltr">
              {recoveryCodes.map((code) => (
                <li
                  key={code}
                  className="rounded-md bg-paper-soft px-2 py-1.5 text-left tracking-wide"
                >
                  {code}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyText("recovery", recoveryCodes.join("\n"))}
            >
              {copied === "recovery" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              کپی همه
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="غیرفعال کردن ۲FA"
        subtitle="کد authenticator یا یک کد بازیابی را وارد کنید"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDisableOpen(false)}>
              انصراف
            </Button>
            <Button
              type="button"
              variant="danger"
              data-testid="two-factor-disable-confirm"
              loading={busy === "disable"}
              disabled={useDisableRecovery ? !disableRecovery.trim() : disableCode.length !== 6}
              onClick={confirmDisable}
            >
              غیرفعال کردن
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {!useDisableRecovery ? (
            <label className="block space-y-1.5 text-right" dir="rtl">
              <span className="block text-[12px] font-medium text-ink-soft">کد ۶ رقمی</span>
              <input
                data-testid="two-factor-disable-code"
                type="text"
                inputMode="numeric"
                dir="rtl"
                value={disableCode ? withRtlMark(faStr(disableCode)) : ""}
                onChange={(e) =>
                  setDisableCode(toEnDigits(stripBidiMarks(e.target.value)).replace(/\D/g, "").slice(0, 6))
                }
                className={`${fieldInputClass} tracking-[0.35em]`}
                placeholder={faStr("000000")}
              />
            </label>
          ) : (
            <label className="block space-y-1.5 text-right" dir="rtl">
              <span className="block text-[12px] font-medium text-ink-soft">کد بازیابی</span>
              <input
                data-testid="two-factor-disable-recovery"
                type="text"
                dir="ltr"
                value={disableRecovery}
                onChange={(e) => setDisableRecovery(stripBidiMarks(e.target.value))}
                className={`${fieldInputClass} text-left font-mono`}
                placeholder="xxxx-xxxx"
              />
            </label>
          )}
          <button
            type="button"
            className="text-[12px] text-ink-soft hover:text-ink"
            onClick={() => setUseDisableRecovery((v) => !v)}
          >
            {useDisableRecovery ? "استفاده از کد authenticator" : "استفاده از کد بازیابی"}
          </button>
        </div>
      </Modal>
    </>
  );
}
