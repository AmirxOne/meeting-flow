import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";
import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { getSessionUser } from "@/server/auth/session";
import { LoginPage } from "./page-client";

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
  if (await platformNeedsSetup()) redirect("/start");
  // کاربر لاگین‌شده نباید فرم لاگین را دوباره ببیند
  if (await getSessionUser()) redirect("/dashboard");
  return <LoginPage />;
}
