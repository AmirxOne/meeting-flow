"use client";

import { useEffect, useState } from "react";
import { UserRound, KeyRound } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";

export default function ProfilePage() {
  const { me, loaded, refresh } = useAuth();
  const { push } = useToast();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
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
    setProfileForm({
      fullName: me.fullName,
      phone: me.phone ?? "",
      jobTitle: me.jobTitle ?? "",
      department: me.department ?? "",
    });
  }, [me]);

  async function saveProfile() {
    setProfileBusy(true);
    try {
      await api("/api/auth/profile", {
        method: "PATCH",
        json: {
          fullName: profileForm.fullName.trim(),
          phone: profileForm.phone.trim(),
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
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        <SkeletonBlock className="h-7 w-32" />
        <Card className="p-5">
          <SkeletonBlock className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <UserRound className="h-5 w-5" />
          پروفایل من
        </h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">ویرایش اطلاعات شخصی و تغییر رمز عبور</p>
      </div>

      <Card>
        <CardHeader title="اطلاعات شخصی" subtitle="ایمیل و نقش فقط توسط مدیر قابل تغییر است" />
        <CardBody className="space-y-4">
          <Field label="ایمیل">
            <input
              value={me.email}
              disabled
              dir="ltr"
              className="h-10 w-full rounded-md border border-line bg-paper-soft px-3 text-[13px] text-ink-faint"
            />
          </Field>
          <Field label="نام کامل">
            <input
              value={profileForm.fullName}
              onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <Field label="تلفن">
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
              dir="ltr"
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <Field label="سمت">
            <input
              value={profileForm.jobTitle}
              onChange={(e) => setProfileForm((f) => ({ ...f, jobTitle: e.target.value }))}
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <Field label="واحد سازمانی">
            <input
              value={profileForm.department}
              onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))}
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveProfile} loading={profileBusy} disabled={profileForm.fullName.trim().length < 2}>
              ذخیره پروفایل
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="تغییر رمز عبور"
          subtitle="پس از تغییر، از همه دستگاه‌ها خارج می‌شوید"
        />
        <CardBody className="space-y-4">
          <Field label="رمز فعلی">
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <Field label="رمز جدید">
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <Field label="تکرار رمز جدید">
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              className="h-10 w-full rounded-md border border-line px-3 text-[13px] outline-none focus:border-ink-faint"
            />
          </Field>
          <div className="flex justify-end">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
