import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";

/**
 * عنوان تب یکنواخت برای صفحات داخلی اپ: «صفحه | سازمان».
 * نام سازمان از همان منبع مرکزی (تنظیمات ادمین) — بدون نام: فقط نام صفحه.
 * صفحات عمومی و لاگین metadata خودشان را دارند.
 */
export async function appPageTitle(page: string): Promise<Metadata> {
  const org = await serverOrgName();
  return { title: org ? `${page} | ${org}` : page };
}
