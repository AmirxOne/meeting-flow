"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "@/components/ui/icon";
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
  sm: "h-8 px-3 text-[12px] rounded-md gap-1.5",
  md: "h-10 px-4 text-[13px] rounded-md gap-2",
  lg: "h-11 px-5 text-[14px] rounded-md gap-2",
  icon: "h-9 w-9 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
