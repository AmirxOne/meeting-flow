"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib";

const SIZE_PX = { sm: 32, md: 40, lg: 64, xl: 96 } as const;

const VARIANT: Record<"ink" | "soft" | "amber", string> = {
  ink: "bg-ink text-white",
  soft: "bg-paper-soft text-ink",
  amber: "bg-amber-50 text-amber-700",
};

export function UserAvatar({
  name,
  src,
  size = "md",
  variant = "soft",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE_PX | number;
  variant?: "ink" | "soft" | "amber";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const letter = name.trim().slice(0, 1) || "؟";
  const showImg = Boolean(src) && !failed;
  const font = px >= 64 ? 22 : px >= 40 ? 14 : 11;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        !showImg && VARIANT[variant],
        className,
      )}
      style={{ width: px, height: px, fontSize: font }}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}
