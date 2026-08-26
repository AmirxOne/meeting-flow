"use client";

import { cn } from "@/lib";
import { SlidersHorizontal } from "lucide-react";

export interface FilterChipsGroup {
  key: string;
  label?: string;
  options: { value: string; label: string; count?: number }[];
}

/**
 * Professional filter bar: a contained toolbar with icon header,
 * segmented chip groups, active count + clear action.
 */
export function FilterBar({
  groups,
  value,
  onChange,
  children,
  className,
}: {
  groups: FilterChipsGroup[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** extra inputs (search box, selects…) rendered inline */
  children?: React.ReactNode;
  className?: string;
}) {
  const activeCount = groups.reduce(
    (acc, g) => acc + (value[g.key] ? 1 : 0),
    0,
  );

  return (
    <div className={cn("rounded-lg border border-line bg-paper-soft/40 px-4 py-3", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-ink-soft" />
          <span className="text-[12px] font-bold">فیلترها</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
              {activeCount} فعال
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const cleared: Record<string, string> = {};
              for (const g of groups) cleared[g.key] = "";
              onChange(cleared);
            }}
            className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            پاک کردن همه
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {groups.map((g) => {
          const groups2 = g.options.length;
          return (
            <div key={g.key} className="flex items-center gap-2">
              {g.label && (
                <span className="shrink-0 text-[11px] font-medium text-ink-soft">{g.label}:</span>
              )}
              <div
                className={cn(
                  "flex overflow-hidden rounded-md border bg-white",
                  groups2 > 5 ? "flex-wrap rounded-md border-line p-0.5 gap-0.5" : "border-line",
                )}
              >
                {g.options.map((opt) => {
                  const active = value[g.key] === opt.value;
                  const isAny = opt.value === "";
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange({ ...value, [g.key]: opt.value })}
                      className={cn(
                        "relative whitespace-nowrap px-3 py-1.5 text-[12px] transition-colors",
                        groups2 > 5
                          ? cn("rounded-md", active ? "bg-ink font-medium text-white" : "text-ink-soft hover:bg-paper-soft")
                          : cn(active ? "bg-ink font-medium text-white" : "text-ink-soft hover:bg-paper-soft"),
                        !active && isAny && groups2 <= 5 && "border-l border-line last:border-l-0",
                      )}
                    >
                      {opt.label}
                      {opt.count !== undefined && (
                        <span
                          className={cn(
                            "mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            active ? "bg-white/20 text-white" : "bg-paper-deep text-ink-soft",
                          )}
                        >
                          {opt.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {children && <div className="flex min-w-48 flex-1 items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
