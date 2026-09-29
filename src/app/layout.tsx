import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { ConnectivityToast } from "@/components/pwa/connectivity-toast";
import { FALLBACK_ORG_NAME } from "@/lib/org-branding";
import { serverOrgName } from "@/lib/server-org-name";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
};

const orgName = await serverOrgName();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: {
    default: `${orgName} — سامانه‌ی فارسی مدیریت جلسات سازمانی`,
    template: `%s | ${orgName}`,
  },
  description: `سیستم مدیریت جلسات ${orgName} — اتاق‌ها، زمان‌بندی و تأییدها`,
  applicationName: orgName,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: orgName,
  },
  formatDetection: { telephone: false },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icon.png", sizes: "any" }, // لوگوی سازمان از تنظیمات — داینامیک
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
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
