"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, KeyRound, CalendarDays, Copy, Check, Download, CheckCircle2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { cn, faStr, formatJalali, joinFullName, splitFullName, stripBidiMarks, toEnDigits, withRtlMark } from "@/lib";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarCropModal } from "@/components/profile/avatar-crop-modal";
import { TwoFactorCard } from "./two-factor-card";
import { WebPushCard } from "./web-push-card";
import { NotificationPrefsCard } from "./notification-prefs-card";
import { DelegatesCard } from "./delegates-card";

const fieldInputClass =
  "h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15";

export function ProfilePage() {
  const { me, loaded, refresh } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    jobTitle: "",
    department: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!me) return;
    const { firstName, lastName } = splitFullName(me.fullName);
    setProfileForm({
      firstName,
      lastName,
      phone: me.phone ?? "",
      jobTitle: me.jobTitle ?? "",
      department: me.department ?? "",
    });
  }, [me]);

  function pickAvatar(file: File | undefined) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      push("حجم تصویر حداکثر ۲ مگابایت است", "error");
      return;
    }
    const okType = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
    if (!okType) {
      push("فقط تصویر (JPG، PNG، WebP یا GIF) مجاز است", "error");
      return;
    }
    setCropFile(file);
  }

  async function saveAvatar(blob: Blob) {
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      await api("/api/auth/avatar", { method: "POST", body: fd });
      push("تصویر پروفایل ذخیره شد", "success");
      setCropFile(null);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["colleagues"] });
      await qc.invalidateQueries({ queryKey: ["people-page"] });
      await qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await api("/api/auth/avatar", { method: "DELETE" });
      push("تصویر پروفایل حذف شد", "success");
      await refresh();
      await qc.invalidateQueries({ queryKey: ["colleagues"] });
      await qc.invalidateQueries({ queryKey: ["people-page"] });
      await qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveProfile() {
    setProfileBusy(true);
    try {
      await api("/api/auth/profile", {
        method: "PATCH",
        json: {
          fullName: joinFullName(profileForm.firstName, profileForm.lastName),
          phone: toEnDigits(profileForm.phone.trim()),
          jobTitle: profileForm.jobTitle.trim(),
          department: profileForm.department.trim(),
        },
      });
      push("پروفایل ذخیره شد", "success");
      await refresh();
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      push("رمز جدید و تکرار آن یکسان نیست", "error");
      return;
    }
    setPasswordBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        json: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });
      push("رمز عبور تغییر کرد — لطفاً دوباره وارد شوید", "success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      window.location.href = "/login";
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setPasswordBusy(false);
    }
  }

  if (!loaded || !me) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-7 w-32" />
        <Card className="p-5">
          <SkeletonBlock className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <UserRound className="h-5 w-5" />
          پروفایل من
        </h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">ویرایش اطلاعات شخصی، رمز عبور، اعلان‌ها، تأیید دو مرحله‌ای و همگام‌سازی تقویم</p>
      </div>

      <Card>
        <CardHeader title="اطلاعات شخصی" subtitle="ایمیل و نقش فقط توسط مدیر قابل تغییر است" />
        <CardBody>
          <div
            data-tour="profile-avatar"
            className="mb-5 flex flex-col items-center gap-3 border-b border-line pb-5 sm:flex-row sm:items-start"
          >
            <UserAvatar name={me.fullName} src={me.avatarUrl} size="xl" variant="ink" />
            <div className="min-w-0 flex-1 text-center sm:text-right">
              <p className="text-[13px] font-medium">تصویر پروفایل</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                مربع، حداکثر ۲ مگابایت — JPG، PNG، WebP یا GIF
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy}
                >
                  انتخاب تصویر
                </Button>
                {me.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeAvatar}
                    loading={avatarBusy}
                  >
                    حذف تصویر
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  pickAvatar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <AvatarCropModal
            open={Boolean(cropFile)}
            file={cropFile}
            busy={avatarBusy}
            onClose={() => setCropFile(null)}
            onConfirm={saveAvatar}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ایمیل">
              <input
                value={withRtlMark(faStr(me.email))}
                disabled
                dir="rtl"
                className={cn(fieldInputClass, "bg-paper-soft text-ink-faint")}
              />
            </Field>
            <Field label="تلفن">
              <input
                value={withRtlMark(faStr(profileForm.phone))}
                onChange={(e) =>
                  setProfileForm((f) => ({
                    ...f,
                    phone: toEnDigits(stripBidiMarks(e.target.value)),
                  }))
                }
                inputMode="tel"
                dir="rtl"
                className={fieldInputClass}
              />
            </Field>
            <Field label="نام">
              <input
                value={profileForm.firstName}
                onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                autoComplete="given-name"
                className={fieldInputClass}
              />
            </Field>
            <Field label="نام خانوادگی">
              <input
                value={profileForm.lastName}
                onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="family-name"
                className={fieldInputClass}
              />
            </Field>
            <Field label="سمت">
              <input
                value={profileForm.jobTitle}
                onChange={(e) => setProfileForm((f) => ({ ...f, jobTitle: e.target.value }))}
                className={fieldInputClass}
              />
            </Field>
            <Field label="واحد سازمانی">
              <input
                value={profileForm.department}
                onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))}
                className={fieldInputClass}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              onClick={saveProfile}
              loading={profileBusy}
              disabled={joinFullName(profileForm.firstName, profileForm.lastName).length < 2}
            >
              ذخیره پروفایل
            </Button>
          </div>
        </CardBody>
      </Card>

      <TwoFactorCard />

      <NotificationPrefsCard />

      <DelegatesCard />

      <WebPushCard />

      <CalendarFeedCard />

      <GoogleCalendarCard />

      <OutlookCalendarCard />

      <Card>
        <CardHeader
          title="تغییر رمز عبور"
          subtitle="پس از تغییر، از همه دستگاه‌ها خارج می‌شوید"
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رمز فعلی" className="sm:col-span-2">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                autoComplete="current-password"
                className={fieldInputClass}
              />
            </Field>
            <Field label="رمز جدید">
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                autoComplete="new-password"
                className={fieldInputClass}
              />
            </Field>
            <Field label="تکرار رمز جدید">
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                autoComplete="new-password"
                className={fieldInputClass}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="secondary"
              onClick={changePassword}
              loading={passwordBusy}
              disabled={
                !passwordForm.currentPassword ||
                passwordForm.newPassword.length < 6 ||
                passwordForm.newPassword !== passwordForm.confirmPassword
              }
            >
              <KeyRound className="h-4 w-4" />
              تغییر رمز
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function GoogleCalendarCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["google-calendar"],
    queryFn: () =>
      api<{
        connected: boolean;
        accountEmail: string | null;
        connectedAt: string | null;
      }>("/api/calendar/google"),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (!g) return;
    if (g === "connected") {
      push("تقویم گوگل وصل شد", "success");
      qc.invalidateQueries({ queryKey: ["google-calendar"] });
    } else if (g === "error") {
      push("اتصال به گوگل ناموفق بود", "error");
    }
    params.delete("google");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [push, qc]);

  async function disconnect() {
    setBusy(true);
    try {
      await api("/api/calendar/google", { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["google-calendar"] });
      push("اتصال تقویم گوگل قطع شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const connected = !!data?.connected;

  return (
    <Card data-tour="google-calendar" data-testid="google-calendar-card">
      <CardHeader
        title="تقویم گوگل"
        subtitle="جلسات مهرسا در تقویم گوگل شما ساخته و به‌روز می‌شوند"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <SkeletonBlock className="h-20 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              با وصل کردن حساب، ساخت و ویرایش و لغو جلسه در مهرسا همان رویداد را در تقویم گوگل شما همگام می‌کند.
              اگر وصل نباشید، رزرو جلسه بدون خطا ادامه پیدا می‌کند.
            </p>
            {connected ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p
                    data-testid="google-calendar-status"
                    className="flex items-center gap-1.5 text-[13px] font-medium text-ink"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    وصل است
                  </p>
                  {data?.accountEmail && (
                    <p className="text-[12px] text-ink-soft" dir="rtl">
                      {faStr(data.accountEmail)}
                    </p>
                  )}
                  {data?.connectedAt && (
                    <p className="text-[12px] text-ink-faint">
                      از {formatJalali(new Date(data.connectedAt), { withTime: true })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={busy}
                  onClick={disconnect}
                  data-testid="google-calendar-disconnect"
                >
                  قطع کن
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p data-testid="google-calendar-status" className="text-[13px] text-ink-soft">
                  هنوز وصل نیست
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="google-calendar-connect"
                  onClick={() => {
                    window.location.assign("/api/calendar/google/connect");
                  }}
                >
                  <CalendarDays className="h-4 w-4" />
                  وصل کردن به گوگل
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function OutlookCalendarCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["outlook-calendar"],
    queryFn: () =>
      api<{
        connected: boolean;
        accountEmail: string | null;
        connectedAt: string | null;
      }>("/api/calendar/outlook"),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get("outlook");
    if (!o) return;
    if (o === "connected") {
      push("تقویم Outlook وصل شد", "success");
      qc.invalidateQueries({ queryKey: ["outlook-calendar"] });
    } else if (o === "error") {
      push("اتصال به Outlook ناموفق بود", "error");
    }
    params.delete("outlook");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [push, qc]);

  async function disconnect() {
    setBusy(true);
    try {
      await api("/api/calendar/outlook", { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["outlook-calendar"] });
      push("اتصال تقویم Outlook قطع شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const connected = !!data?.connected;

  return (
    <Card data-tour="outlook-calendar" data-testid="outlook-calendar-card">
      <CardHeader
        title="تقویم Outlook"
        subtitle="جلسات مهرسا در تقویم Outlook شما ساخته و به‌روز می‌شوند"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <SkeletonBlock className="h-20 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              با وصل کردن حساب مایکروسافت، ساخت و ویرایش و لغو جلسه در مهرسا همان رویداد را در Outlook شما همگام می‌کند.
              اگر وصل نباشید، رزرو جلسه بدون خطا ادامه پیدا می‌کند.
            </p>
            {connected ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p
                    data-testid="outlook-calendar-status"
                    className="flex items-center gap-1.5 text-[13px] font-medium text-ink"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    وصل است
                  </p>
                  {data?.accountEmail && (
                    <p className="text-[12px] text-ink-soft" dir="rtl">
                      {faStr(data.accountEmail)}
                    </p>
                  )}
                  {data?.connectedAt && (
                    <p className="text-[12px] text-ink-faint">
                      از {formatJalali(new Date(data.connectedAt), { withTime: true })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={busy}
                  onClick={disconnect}
                  data-testid="outlook-calendar-disconnect"
                >
                  قطع کن
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p data-testid="outlook-calendar-status" className="text-[13px] text-ink-soft">
                  هنوز وصل نیست
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="outlook-calendar-connect"
                  onClick={() => {
                    window.location.assign("/api/calendar/outlook/connect");
                  }}
                >
                  <CalendarDays className="h-4 w-4" />
                  وصل کردن به Outlook
                </Button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function CalendarFeedCard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ httpUrl: string; webcalUrl: string } | null>(null);
  const [copied, setCopied] = useState<"http" | "webcal" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar-feed-token"],
    queryFn: () => api<{ enabled: boolean; createdAt: string | null }>("/api/calendar/feed-token"),
  });

  async function copy(kind: "http" | "webcal", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
    push("لینک کپی شد", "success");
  }

  async function rotate() {
    setBusy("rotate");
    try {
      const res = await api<{ httpUrl: string; webcalUrl: string }>("/api/calendar/feed-token", {
        method: "POST",
      });
      setUrls({ httpUrl: res.httpUrl, webcalUrl: res.webcalUrl });
      qc.invalidateQueries({ queryKey: ["calendar-feed-token"] });
      push(data?.enabled ? "لینک قبلی باطل شد و لینک جدید ساخته شد" : "لینک اشتراک تقویم ساخته شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    try {
      await api("/api/calendar/feed-token", { method: "DELETE" });
      setUrls(null);
      qc.invalidateQueries({ queryKey: ["calendar-feed-token"] });
      push("لینک اشتراک باطل شد", "success");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  const enabled = !!data?.enabled;

  return (
    <Card id="calendar-feed" data-tour="calendar-feed">
      <CardHeader
        title="تقویم خارجی"
        subtitle="دانلود فایل ICS یا اشتراک شخصی در Outlook و Google Calendar — فقط جلسات خودتان"
      />
      <CardBody className="space-y-4">
        {isLoading ? (
          <SkeletonBlock className="h-24 w-full" />
        ) : (
          <>
            <p className="text-[12px] leading-6 text-ink-soft">
              فایل .ics را در تقویم دسکتاپ وارد کنید، یا لینک اشتراک را در Outlook / Google Calendar اضافه کنید.
              لینک فقط جلسات شما را نشان می‌دهد، نه کل سازمان.
            </p>
            {enabled && data?.createdAt && (
              <p className="text-[12px] text-ink-soft">
                لینک فعال از {formatJalali(new Date(data.createdAt), { withTime: true })}
                {!urls && " — برای دیدن آدرس، لینک جدید بسازید (لینک قبلی باطل می‌شود)."}
              </p>
            )}
            {urls && (
              <div className="space-y-3">
                <UrlRow
                  label="لینک HTTPS (گوگل)"
                  value={urls.httpUrl}
                  copied={copied === "http"}
                  onCopy={() => copy("http", urls.httpUrl)}
                />
                <UrlRow
                  label="لینک webcal (اوت‌لوک / اپل)"
                  value={urls.webcalUrl}
                  copied={copied === "webcal"}
                  onCopy={() => copy("webcal", urls.webcalUrl)}
                />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <a href="/api/calendar/ics">
                <Button type="button" variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  دانلود فایل ICS
                </Button>
              </a>
              {enabled && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={busy === "revoke"}
                  onClick={revoke}
                >
                  ابطال لینک
                </Button>
              )}
              <Button
                type="button"
                variant={enabled ? "secondary" : "primary"}
                size="sm"
                loading={busy === "rotate"}
                onClick={rotate}
              >
                <CalendarDays className="h-4 w-4" />
                {enabled ? "ساخت لینک جدید" : "ساخت لینک اشتراک"}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function UrlRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-ink-soft">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          dir="ltr"
          value={value}
          className="h-11 min-w-0 flex-1 rounded-md border border-[#d9d9e0] bg-paper-soft px-3.5 text-left text-[12px] text-ink"
        />
        <Button type="button" variant="outline" size="md" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "کپی شد" : "کپی"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label dir="rtl" className={cn("block space-y-1.5 text-right", className)}>
      <span className="block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
