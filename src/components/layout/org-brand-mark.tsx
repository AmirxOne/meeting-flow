"use client";

import Image from "next/image";
import { cn } from "@/lib";
import { Tooltip } from "@/components/ui/tooltip";

interface OrgBrandMarkProps {
  orgName: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}

/**
 * لوگوی سایدبار/هدر — فقط لوگوی سازمانِ آپلودشده توسط ادمین.
 * تا وقتی ادمین لوگو نگذاشته، هیچ لوگویی نمایش داده نمی‌شود —
 * به‌جایش مونوگرام حرف اول نام سازمان.
 */
export function OrgBrandMark({ orgName, logoUrl, size = 40, className }: OrgBrandMarkProps) {
  const customSrc = logoUrl?.trim() ?? "";
  const hasCustom = customSrc.length > 0;
  const initial = orgName.trim().charAt(0) || "•";

  return (
    <Tooltip content={orgName}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          hasCustom ? "border border-line bg-white" : "bg-paper-soft",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {hasCustom ? (
          <Image
            src={customSrc}
            alt={orgName}
            width={size}
            height={size}
            className="rounded-lg object-contain"
            style={{ width: size, height: size }}
            priority
            unoptimized
          />
        ) : (
          <span
            aria-hidden
            className="select-none font-bold text-ink-soft"
            style={{ fontSize: Math.round(size * 0.42) }}
          >
            {initial}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

/** Auth/bootstrap loading — shimmer box بدون هیچ لوگویی. */
export function BrandLogoSkeleton({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("brand-logo-skeleton relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg skeleton", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
