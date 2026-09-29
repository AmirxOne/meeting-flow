"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { cn } from "@/lib";

/**
 * نوار تب حرفه‌ای — نشانگر متحرک با انیمیشن نرم (مثل Linear/Telegram).
 * آیتم‌ها: { id, label, icon? } — RTL پشتیبانی می‌شود.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; icon?: ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = useState<{ right: number; width: number } | null>(null);

  // اندازه‌گیری نشانگر بر اساس دکمه‌ی فعال — right برای RTL
  useEffect(() => {
    const measure = () => {
      const btn = refs.current[value];
      const track = trackRef.current;
      if (!btn || !track) return;
      const b = btn.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      setPill({ right: t.right - b.right, width: b.width });
    };
    measure();
    // بعد از فونت‌ها/ری‌سایز دوباره اندازه بگیر
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [value, items.length]);

  return (
    <div
      ref={trackRef}
      dir="rtl"
      role="tablist"
      className={cn(
        "relative flex items-center gap-1 rounded-xl border border-line bg-paper-soft/70 p-1 shadow-inner",
        className,
      )}
    >
      {/* نشانگر متحرک زیر آیتم فعال */}
      {pill && (
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition-[right,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ right: pill.right, width: pill.width }}
        />
      )}
      {items.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative z-10 flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium transition-colors duration-200",
              active ? "text-ink" : "text-ink-faint hover:text-ink-soft",
            )}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
