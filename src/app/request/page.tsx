import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const orgName = await serverOrgName();
  return {
  title: { absolute: orgName ? `درخواست جلسه بدون ورود — ${orgName}` : "درخواست جلسه" },
  description:
    "مهمان هستید؟ بدون نیاز به حساب کاربری، درخواست جلسه بدهید: انتخاب بازه‌ی دلخواه با تقویم شمسی، جلسه‌ی حضوری در شرکت یا بیرونی، و پیگیری وضعیت با کد رهگیری.",
  keywords: ["درخواست جلسه", "رزرو جلسه بدون ثبت‌نام", "فرم جلسه مهمان"],
  alternates: { canonical: "/request" },
  openGraph: {
    title: orgName ? `درخواست جلسه بدون ورود — ${orgName}` : "درخواست جلسه",
    description: "بدون حساب کاربری، با تقویم شمسی و انتخاب محل برگزاری.",
    type: "website",
    locale: "fa_IR",
    siteName: orgName,
  },
  };
}

import { PublicRequestForm } from "./page-client";
import { serverOrgName } from "@/lib/server-org-name";

// این صفحه runtime از DB می‌خواند — prerender در build (بدون DB) ممکن نیست
export const dynamic = "force-dynamic";

export default function Page() {
  return <PublicRequestForm />;
}
