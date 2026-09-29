"use client";

import { useEffect, useState } from "react";

/**
 * برندینگ مرکزی سازمان — نام نمایشی که ادمین در تنظیمات وارد می‌کند
 * از /api/public/organization خوانده می‌شود (بدون لاگین، کش‌شده) و
 * در کل سامانه (عنوان تب، سایدبار، هدر لاگین، …) استفاده می‌شود.
 */

export const FALLBACK_ORG_NAME = "مهرسا";

let cache: { name: string } | null = null;
const listeners = new Set<(name: string) => void>();

async function loadName(): Promise<string> {
  try {
    const r = await fetch("/api/public/organization");
    const payload = (await r.json()) as { data?: { organization?: { name?: string } } };
    const name = payload?.data?.organization?.name?.trim();
    return name || FALLBACK_ORG_NAME;
  } catch {
    return FALLBACK_ORG_NAME;
  }
}

/** نام نمایشی سازمان — client-side، کش‌شده در session. */
export function useOrgName(): string {
  const [name, setName] = useState<string>(cache?.name ?? FALLBACK_ORG_NAME);
  useEffect(() => {
    if (cache) {
      // بازخوانی تازه پس از تغییر تنظیمات
      loadName().then((n) => {
        if (n !== cache!.name) {
          cache = { name: n };
          setName(n);
          listeners.forEach((l) => l(n));
        }
      });
      return;
    }
    let alive = true;
    loadName().then((n) => {
      if (!alive) return;
      cache = { name: n };
      setName(n);
    });
    return () => {
      alive = false;
    };
  }, []);
  return name;
}

/** عنوان تب مرورگر را با نام سازمان همگام نگه می‌دارد (تزریق dynamic بعد از hydration). */
export function useOrgDocumentTitle(pageTitle?: string) {
  const orgName = useOrgName();
  useEffect(() => {
    const base = pageTitle ? `${pageTitle} | ${orgName}` : `${orgName} — سامانه‌ی مدیریت جلسات سازمانی`;
    // فقط اگر با پیش‌فرض static فرق دارد به‌روز کن (SEO/metadata سرور دست‌نخورده می‌ماند)
    document.title = base;
  }, [orgName, pageTitle]);
}

/** invalidate کش پس از ذخیره‌ی تنظیمات برندینگ. */
export function invalidateOrgBranding() {
  cache = null;
}

/** displayName سرور-عاملی برای ایمیل/پیامک — از DB مستقیم. */
export async function getServerOrgName(): Promise<string> {
  if (cache) return cache.name;
  const n = await loadName();
  cache = { name: n };
  return n;
}
