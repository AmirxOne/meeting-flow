"use client";

import Image from "next/image";
import { useOrgLogoUrl } from "@/lib/org-branding";
import { cn } from "@/lib";

/**
 * لوگوی برند سازمان — به نقطه‌ی مرکزی (تنظیمات ادمین → آپلود لوگو) متصل است.
 * اگر سازمان لوگو آپلود کرده باشد همان سرو می‌شود؛ وگرنه **هیچ لوگویی نمایش
 * داده نمی‌شود** — به‌جایش مونوگرام (حرف اول نام سازمان) تا ادمین لوگو بگذارد.
 */
export function BrandLogo({
  size = 32,
  className,
  priority,
  alt,
  orgName,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  orgName?: string;
}) {
  const orgLogo = useOrgLogoUrl();
  const initial = (orgName ?? "").trim().charAt(0) || "•";

  if (orgLogo) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-md", className)}
        style={{ width: size, height: size }}
      >
        <Image
          src={orgLogo}
          alt={alt ?? ""}
          width={size}
          height={size}
          className="object-contain"
          style={{ width: size, height: size }}
          priority={priority}
          unoptimized
        />
      </span>
    );
  }

  // بدون لوگوی سازمانی — مونوگرام حرف اول (هیچ لوگوی پیش‌فرضی نمایش داده نمی‌شود)
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-md bg-paper-soft font-bold text-ink-soft",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initial}
    </span>
  );
}
