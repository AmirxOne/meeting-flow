"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2a2a2e] disabled:opacity-50",
  secondary: "bg-paper-soft text-ink hover:bg-paper-deep disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-paper-soft hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  outline: "border border-line bg-white text-ink hover:bg-paper-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3 text-[12px] rounded-md gap-1.5",
  md: "h-10 px-4 text-[13px] rounded-md gap-2",
  lg: "h-11 px-5 text-[14px] rounded-md gap-2",
  icon: "h-9 w-9 rounded-md",
};

/**
 * اسپینر بارگذاری دکمه — سه میله‌ی کش‌آمده (سبک ScaleLoader) با CSS خالص.
 * رنگ میله‌ها از رنگ متن فعلی دکمه پیروی می‌کند (currentColor).
 */
function ButtonScaleSpinner() {
  return (
    <span className="btn-scale-spinner" aria-hidden="true" dir="ltr">
      <span />
      <span />
      <span />
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {/* در حالت لودینگ: متن محو و اسپینر وسط دکمه */}
      {loading ? <ButtonScaleSpinner /> : children}
    </button>
  );
});
