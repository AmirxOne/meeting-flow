import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "درخواست جلسه بدون ورود — مهرسا" },
  description:
    "مهمان هستید؟ بدون نیاز به حساب کاربری، درخواست جلسه بدهید: انتخاب بازه‌ی دلخواه با تقویم شمسی، جلسه‌ی حضوری در شرکت یا بیرونی، و پیگیری وضعیت با کد رهگیری.",
  keywords: ["درخواست جلسه", "رزرو جلسه بدون ثبت‌نام", "فرم جلسه مهمان"],
  alternates: { canonical: "/request" },
  openGraph: {
    title: "درخواست جلسه بدون ورود — مهرسا",
    description: "بدون حساب کاربری، با تقویم شمسی و انتخاب محل برگزاری.",
    type: "website",
    locale: "fa_IR",
    siteName: "مهرسا",
  },
};

import { PublicRequestForm } from "./page-client";

export default function Page() {
  return <PublicRequestForm />;
}
