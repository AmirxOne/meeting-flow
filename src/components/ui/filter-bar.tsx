"use client";

import { useState } from "react";
import { cn } from "@/lib";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, Check, ChevronDown } from "@/components/ui/icon";

export interface FilterChipsGroup {
  key: string;
  label?: string;
  options: { value: string; label: string; count?: number }[];
}

function FilterDropdown({
  group,
  selected,
  onSelect,
}: {
  group: FilterChipsGroup;
  selected: string;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = group.options.find((o) => o.value === selected);
  const isFiltered = selected !== "" && selected !== undefined;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[12px] transition-colors",
          open
            ? "border-ink shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
            : isFiltered
              ? "border-ink font-medium text-ink"
              : "border-line text-ink-soft hover:border-ink/50",
        )}
      >
        {group.label && <span className="text-ink-soft">{group.label}:</span>}
        <span className={cn(isFiltered ? "font-medium text-ink" : "text-ink-soft")}>
          {current?.label ?? "همه"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-ink-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] z-20 max-h-64 w-52 overflow-y-auto rounded-md border border-line bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
          >
            {group.options.map((opt) => {
              const active = opt.value === selected;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-[12px] transition-colors hover:bg-paper-soft",
                    active && "font-bold",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {opt.label}
                    {opt.count !== undefined && (
                      <span className="rounded-full bg-paper-deep px-1.5 py-0.5 text-[9px] font-bold text-ink-soft">
                        {opt.count}
                      </span>
                    )}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-ink" />}
                </li>
              );
            })}
          </motion.ul>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Professional filter bar: contained toolbar with icon header,
 * dropdown-based filter groups (scales to many options), active
 * count + clear action, inline search/extra children.
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
  /** extra inputs (search box, date pickers…) rendered inline */
  children?: React.ReactNode;
  className?: string;
}) {
  const activeCount = groups.reduce(
    (acc, g) => acc + (value[g.key] && value[g.key] !== "" ? 1 : 0),
    0,
  );

  return (
    <div className={cn("rounded-md border border-line bg-paper-soft/40 px-4 py-3", className)}>
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

      <div className="flex flex-wrap items-center gap-2">
        {groups.map((g) => (
          <FilterDropdown
            key={g.key}
            group={g}
            selected={value[g.key] ?? ""}
            onSelect={(v) => onChange({ ...value, [g.key]: v })}
          />
        ))}

        {children && (
          <div className="flex min-w-0 max-w-full flex-[1_1_20rem] flex-wrap items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
