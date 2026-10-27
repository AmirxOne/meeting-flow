import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";
import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { getSessionUser } from "@/server/auth/session";
import { LoginPage } from "./page-client";

// این صفحه runtime از DB می‌خواند — prerender در build (بدون DB) ممکن نیست
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await serverOrgName();
  return {
    title: { absolute: `ورود به حساب — ${org}` },
    description: `ورود به سامانه‌ی مدیریت جلسات ${org} با ایمیل یا شماره موبایل سازمانی.`,
    alternates: { canonical: "/login" },
    robots: { index: false },
  };
}

export default async function Page() {
  // راه‌اندازی اولیه پشت لاگین است — /login همیشه نمایش داده می‌شود
  // (قبلاً به /start ریدایرکت می‌کرد که با لاگین-الزامی /start حلقه می‌ساخت)
  // کاربر لاگین‌شده نباید فرم لاگین را دوباره ببیند
  const user = await getSessionUser();
  if (user && !(await platformNeedsSetup())) redirect("/dashboard");
  return <LoginPage />;
}
