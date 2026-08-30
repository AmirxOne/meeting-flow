"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, CalendarDays } from "@/components/ui/icon";
import { cn, faNum } from "@/lib";
import { Select } from "@/components/ui/select";
import { jMonthGrid, J_MONTHS, J_WEEKDAYS_SHORT, toJalali, toGregorian } from "@/lib/jalali";

export interface JalaliDateValue {
  jy: number;
  jm: number;
  jd: number;
}

function isoOfJalali(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
}

function jalaliOfIso(iso: string): JalaliDateValue {
  const [y, m, d] = iso.split("-").map(Number);
  return toJalali(new Date(y, m - 1, d));
}

/**
 * Custom Jalali (شمسی) DatePicker — replaces every native date input.
 * Month grid, Saturday-start week, Persian digits, min/max support.
 * Value is a gregorian ISO string (YYYY-MM-DD) for easy API interop;
 * display is fully Jalali.
 */
export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  min, // ISO
  max, // ISO
  disabled,
  className = "",
}: {
  value: string; // "" | "YYYY-MM-DD"
  onChange: (iso: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => toJalali(new Date()), []);
  const selected = value ? jalaliOfIso(value) : null;

  const [view, setView] = useState<{ jy: number; jm: number }>(() =>
    selected ?? { jy: today.jy, jm: today.jm },
  );

  useEffect(() => {
    if (selected) setView({ jy: selected.jy, jm: selected.jm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function monthDelta(delta: number) {
    let { jy, jm } = view;
    jm += delta;
    if (jm > 12) { jm = 1; jy += 1; }
    if (jm < 1) { jm = 12; jy -= 1; }
    setView({ jy, jm });
  }

  const grid = jMonthGrid(view.jy, view.jm);

  const label = selected
    ? `${faNum(selected.jd)} ${J_MONTHS[selected.jm - 1]} ${faNum(selected.jy)}`
    : placeholder;

  function isDisabled(jd: number): boolean {
    if (disabled) return true;
    const iso = isoOfJalali(view.jy, view.jm, jd);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function pick(jd: number) {
    if (isDisabled(jd)) return;
    onChange(isoOfJalali(view.jy, view.jm, jd));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-[13px] text-right transition-colors",
          disabled
            ? "cursor-not-allowed border-[#ececf1] bg-paper-soft text-ink-faint"
            : open
              ? "border-ink shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
              : "border-[#d9d9e0] hover:border-ink/50",
        )}
      >
        <span className={cn("flex-1 truncate", selected ? "font-medium text-ink" : "text-ink-faint")}>
          {label}
        </span>
        <CalendarDays className={cn("h-4 w-4 shrink-0", selected ? "text-ink" : "text-ink-faint")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[290px] rounded-lg border border-line bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          {/* month header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => monthDelta(-1)}
              className="rounded-md p-1.5 hover:bg-paper-soft"
              aria-label="ماه قبل"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <p className="text-[13px] font-bold">
              {J_MONTHS[view.jm - 1]} {faNum(view.jy)}
            </p>
            <button
              type="button"
              onClick={() => monthDelta(1)}
              className="rounded-md p-1.5 hover:bg-paper-soft"
              aria-label="ماه بعد"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7">
            {J_WEEKDAYS_SHORT.map((d, i) => (
              <div key={i} className="py-1.5 text-center text-[11px] font-medium text-ink-soft">
                {d}
              </div>
            ))}
          </div>

          {/* grid */}
          <div className="grid grid-cols-7">
            {grid.map((cell, i) => {
              if (!cell) return <div key={i} className="h-9" />;
              const isSel =
                selected?.jy === cell.jy && selected?.jm === cell.jm && selected?.jd === cell.jd;
              const isToday =
                today.jy === cell.jy && today.jm === cell.jm && today.jd === cell.jd;
              const dis = isDisabled(cell.jd);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={dis}
                  onClick={() => pick(cell.jd)}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-md text-[12px] transition-colors",
                    dis && "cursor-not-allowed text-ink-faint/40",
                    !dis && !isSel && "hover:bg-paper-soft",
                    isToday && !isSel && "border border-ink/30 font-bold",
                    isSel && "bg-ink font-bold text-white",
                  )}
                >
                  {faNum(cell.jd)}
                </button>
              );
            })}
          </div>

          {/* quick: today */}
          <button
            type="button"
            onClick={() => {
              onChange(isoOfJalali(today.jy, today.jm, today.jd));
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md border border-line py-2 text-[12px] text-ink-soft transition-colors hover:bg-paper-soft"
          >
            امروز
          </button>
        </div>
      )}
    </div>
  );
}

/** Persian time picker — custom Select dropdowns (no native <select>). */
export function TimePicker({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: string; // "HH:MM" | ""
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [h, m] = value.split(":").map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Select
        disabled={disabled}
        value={Number.isFinite(h) ? String(h) : ""}
        onChange={(v) => onChange(`${v.padStart(2, "0")}:${Number.isFinite(m) ? String(m).padStart(2, "0") : "00"}`)}
        placeholder="ساعت"
        options={hours.map((x) => ({ value: String(x), label: faNum(String(x).padStart(2, "0")) }))}
      />
      <Select
        disabled={disabled}
        value={Number.isFinite(m) ? String(m) : ""}
        onChange={(v) => onChange(`${Number.isFinite(h) ? String(h).padStart(2, "0") : "00"}:${v.padStart(2, "0")}`)}
        placeholder="دقیقه"
        options={minutes.map((x) => ({ value: String(x), label: faNum(String(x).padStart(2, "0")) }))}
      />
    </div>
  );
}
