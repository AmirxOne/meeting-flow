"use client";

/**
 * ScrollCell — کانتینر اسکرولی با Progressive Blur هوشمند:
 * بلور پایین فقط وقتی محتوا سرریز دارد و هنوز به انتها نرسیده‌ایم؛
 * به انتهای اسکرول که رسید، بلور محو می‌شود تا آخرین آیتم کامل دیده شود.
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib";
import { ProgressiveBlur } from "./progressive-blur";

export function ScrollCell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // فرض اولیه: سرریز دارد و پایینیم نیستیم — بعد از mount موقعیت واقعی خوانده می‌شود
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 2);
  }, []);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    // فاصله از انتها کمتر از ۲ پیکسل = رسیدیم به ته
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 2);
  }

  return (
    <div className="relative">
      <div ref={ref} onScroll={onScroll} className={cn("no-scrollbar overflow-y-auto", className)}>
        {children}
      </div>
      {!atBottom && (
        <ProgressiveBlur position="bottom" height="26%" blurLevels={[0.5, 1, 2, 4, 8, 16]} className="rounded-b-sm" />
      )}
    </div>
  );
}
