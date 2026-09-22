import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "ورود به حساب — مهرسا" },
  description: "ورود به سامانه‌ی مدیریت جلسات مهرسا با ایمیل یا شماره موبایل سازمانی.",
  alternates: { canonical: "/login" },
  robots: { index: false },
};

import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { LoginPage } from "./page-client";

export default async function Page() {
  if (await platformNeedsSetup()) redirect("/start");
  return <LoginPage />;
}
