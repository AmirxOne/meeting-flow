"use client";

import Image from "next/image";
import { useOrgLogoUrl } from "@/lib/org-branding";
import { cn } from "@/lib";

/**
 * لوگوی برند سازمان — به نقطه‌ی مرکزی (تنظیمات ادمین → آپلود لوگو) متصل است.
 * اگر سازمان لوگو آپلود کرده باشد همان سرو می‌شود؛ وگرنه لوگوی پیش‌فرض مهرسا.
 * src خارجی یا /api — هر دو unoptimized تا next/image درخواست اضافه نزند.
 */
export function BrandLogo({
  size = 32,
  className,
  priority,
  alt,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  const orgLogo = useOrgLogoUrl();
  const src = orgLogo ?? "/logo-white.png";
  const isCustom = !!orgLogo;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", isCustom ? "rounded-md" : "", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt ?? ""}
        width={size}
        height={size}
        className={cn("object-contain", isCustom ? "rounded-md" : "")}
        style={{ width: size, height: size }}
        priority={priority}
        unoptimized={isCustom}
      />
    </span>
  );
}
