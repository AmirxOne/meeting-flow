"use client";

import Image from "next/image";
import { cn } from "@/lib";

interface OrgBrandMarkProps {
  orgName: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}

/** Sidebar/header logo — custom org logo or default مهرسا mark. */
export function OrgBrandMark({ orgName, logoUrl, size = 40, className }: OrgBrandMarkProps) {
  const customSrc = logoUrl?.trim() ?? "";
  const hasCustom = customSrc.length > 0;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        hasCustom ? "border border-line bg-white" : "bg-ink",
        className,
      )}
      style={{ width: size, height: size }}
      title={orgName}
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
        <Image
          src="/logo-white.png"
          alt={orgName}
          width={size}
          height={size}
          className="object-contain"
          style={{ width: size, height: size }}
          priority
        />
      )}
    </div>
  );
}

/** Auth/bootstrap loading — square shimmer box with centered gray logo. */
export function BrandLogoSkeleton({ size = 40, className }: { size?: number; className?: string }) {
  const icon = Math.round(size * 0.62);
  return (
    <div
      className={cn(
        "brand-logo-skeleton relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg skeleton",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Image
        src="/logo-white.png"
        alt=""
        width={icon}
        height={icon}
        className="relative z-10 object-contain opacity-30 grayscale"
        priority
      />
    </div>
  );
}
