import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "مهرسا — سامانه‌ی فارسی مدیریت جلسات سازمانی" },
  description:
    "درخواست جلسه، هماهنگی اتاق‌ها، دعوت‌نامه‌ی پیامک و ایمیل، برگزاری با QR، صورت‌جلسه‌ی محرمانه و گزارش مدیریتی — همه فارسی، راست‌چین و با تقویم شمسی.",
  keywords: ["مدیریت جلسات", "رزرو اتاق جلسه", "تقویم شمسی", "صورت جلسه", "سامانه جلسات سازمانی", "مهرسا"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "مهرسا — سامانه‌ی فارسی مدیریت جلسات سازمانی",
    description: "کل چرخه‌ی جلسه: درخواست، هماهنگی، برگزاری، صورت‌جلسه و گزارش — با تقویم شمسی.",
    type: "website",
    locale: "fa_IR",
    siteName: "مهرسا",
  },
  twitter: { card: "summary_large_image", title: "مهرسا — مدیریت جلسات سازمانی" },
};

import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { LandingPage } from "./page-client";

export default async function Page() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  if (await platformNeedsSetup()) redirect("/start");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "مهرسا",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: "fa-IR",
            description:
              "سامانه‌ی فارسی مدیریت جلسات سازمانی: درخواست، هماهنگی، دعوت‌نامه، برگزاری با QR، صورت‌جلسه و گزارش مدیریتی با تقویم شمسی.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
          }),
        }}
      />
      <LandingPage />
    </>
  );
}
