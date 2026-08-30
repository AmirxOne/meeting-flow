"use client";

import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={280} skipDelayDuration={120}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  if (content == null || content === "") return children;

  const trigger =
    isValidElement(children) && typeof content === "string"
      ? cloneElement(children as ReactElement<{ "data-tooltip"?: string }>, {
          "data-tooltip": content,
        })
      : children;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          dir="rtl"
          className={cn(
            "z-[80] max-w-xs select-none rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-medium leading-5 text-white",
            "shadow-[0_8px_24px_rgba(13,13,13,0.18)]",
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow width={10} height={5} className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Icon-only action button with a custom tooltip (no native title). */
export function IconTipButton({
  tip,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tip: string }) {
  return (
    <Tooltip content={tip}>
      <button type={type} aria-label={tip} className={className} {...rest}>
        {children}
      </button>
    </Tooltip>
  );
}
