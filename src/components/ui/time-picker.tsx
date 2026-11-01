"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "@/components/ui/icon";
import { faNum, toEnDigits } from "@/lib/fa";
import { cn } from "@/lib";

/**
 * TimePicker کاستوم — جایگزین تایپ دستی ساعت.
 * پنل popover: ساعت‌های ۰۷:۰۰ تا ۲۱:۴۵ با گام ۱۵ دقیقه، اعداد فارسی،
 * همان زبان بصری JalaliDatePicker. مقدار: "HH:MM" لاتین.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "انتخاب ساعت",
  disabled,
  className = "",
}: {
  value: string; // "" | "HH:MM"
  onChange: (hhmm: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => position();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    position();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function position() {
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    const ph = panelRef.current?.offsetHeight ?? 320;
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - 238);
    setPos({ top, left });
  }

  const display = value ? faNum(value) : "";

  // ساعت‌های 07:00 تا 21:45 گام ۱۵ دقیقه — ۴ ستونه
  const times: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          "flex h-10 w-full items-center justify-between gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] transition-colors " +
          (disabled ? "cursor-not-allowed bg-paper-soft text-ink-faint" : "text-ink hover:border-ink/40 focus:border-ink")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("tabular-nums", !value && "text-ink-faint/70")}>{display || placeholder}</span>
        <Clock className="size-4 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          style={pos ? { top: pos.top, left: pos.left } : undefined}
          className="fixed z-[80] max-h-72 w-[232px] overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]"
        >
          <div className="grid grid-cols-4 gap-1">
            {times.map((t) => {
              const sel = value === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md py-1.5 text-[12px] tabular-nums transition-colors",
                    sel ? "bg-ink font-bold text-white" : "text-ink hover:bg-paper-soft",
                  )}
                  dir="ltr"
                >
                  {faNum(t)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 border-t border-line pt-1.5 text-center text-[10px] text-ink-faint">
            گام‌های ۱۵ دقیقه‌ای — ۰۷:۰۰ تا ۲۱:۴۵
          </p>
        </div>
      )}
    </div>
  );
}
