import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { ConnectivityToast } from "@/components/pwa/connectivity-toast";
import { serverOrgName } from "@/lib/server-org-name";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
};

const orgName = await serverOrgName(); // "" تا وقتی ادمین نام واقعی را ثبت نکرده
const titleDefault = orgName ? `${orgName} — سامانه‌ی مدیریت جلسات سازمانی` : "سامانه‌ی مدیریت جلسات سازمانی";
const titleTemplate = orgName ? `%s | ${orgName}` : "%s";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: {
    default: titleDefault,
    template: titleTemplate,
  },
  description: orgName ? `سیستم مدیریت جلسات ${orgName} — اتاق‌ها، زمان‌بندی و تأییدها` : "سیستم مدیریت جلسات — اتاق‌ها، زمان‌بندی و تأییدها",
  applicationName: orgName || undefined,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: orgName,
  },
  formatDetection: { telephone: false },
  icons: {
    // فقط آیکون داینامیک — لوگوی سازمان از تنظیمات (نقطه‌ی مرکزی برندینگ)؛
    // بدون آن، مونوگرام خنثی. آیکون‌های استاتیک قدیمی حذف شدند تا لوگوی
    // پیش‌فرض نمایش داده نشود.
    icon: [{ url: "/icon.png", sizes: "any" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Alibaba-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Alibaba-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <PwaRegister />
          <ConnectivityToast />
        </Providers>
      </body>
    </html>
  );
}
