"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "@/components/ui/icon";
import { cn } from "@/lib";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface SelectOption {
  value: string;
  label: string;
  /** sub-label line — native <select> can't do this */
  hint?: string;
  disabled?: boolean;
}

/**
 * Custom dropdown — replaces every native <select> (project mandate: no OS-default look).
 * 44px fields per the form kit spec, ChatGPT-monochrome theme.
 * Keyboard: ↑↓ navigate, Enter/Space select, Esc/Tab close. Click-outside closes.
 * Lint note: highlight reset happens in the click/keydown HANDLERS, not in an effect.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // portal'd panel anchor — never clipped by ancestor overflow
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const updatePos = () => {
    if (!open || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    // measure the REAL panel height; assume full 256 until first paint settles
    const measured = listRef.current?.offsetHeight ?? 0;
    const ph = Math.min(measured > 0 ? measured : 256, 256);
    const wh = window.innerHeight;
    const spaceBelow = wh - 8 - r.bottom;
    const spaceAbove = r.top - 8;
    let top: number;
    if (ph <= spaceBelow - 6) top = r.bottom + 6;            // fits below — flush
    else if (ph <= spaceAbove - 6) top = r.top - 6 - ph;      // flip above — flush
    else if (spaceBelow >= spaceAbove) top = Math.max(8, wh - 8 - ph); // clamp below
    else top = 8;                                             // clamp above
    setPanelPos({ top, left: r.left, width: r.width });
  };
  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    // re-measure AFTER the portal mounts (real height) and settle animations
    const id1 = requestAnimationFrame(updatePos);
    const id2 = setTimeout(updatePos, 60);
    return () => { cancelAnimationFrame(id1); clearTimeout(id2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = () => updatePos();
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => {
      window.removeEventListener("scroll", h, true);
      window.removeEventListener("resize", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t)) return; // inside the portalled listbox
      if (rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    // scroll INSIDE the listbox only — never scrollIntoView (it drags the whole page)
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const el = list.children[active] as HTMLElement | undefined;
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [active, open]);

  function resetHighlight() {
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }

  function pick(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) pick(active);
        else {
          resetHighlight();
          setOpen(true);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          resetHighlight();
          setOpen(true);
        } else setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((a) => Math.max(0, a - 1));
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const h = size === "sm" ? "h-9 text-[12px]" : "h-11 text-[13px]";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) resetHighlight();
          setOpen((v) => !v);
        }}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3.5 text-right transition-colors",
          h,
          disabled
            ? "cursor-not-allowed border-[#ececf1] bg-[#f7f7f8] text-[#9b9ba7]"
            : open
              ? "border-ink shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
              : "border-[#d9d9e0] hover:border-ink/50",
        )}
      >
        <span className={cn("flex-1 truncate", selected ? "font-medium text-ink" : "text-ink-faint")}>
          {selected ? selected.label : (placeholder ?? "انتخاب کنید…")}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180",
            selected ? "text-ink" : "text-ink-faint",
          )}
        />
      </button>

      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {open && (
        <motion.ul
          ref={listRef}
          style={panelPos ? { position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width } : { position: "fixed", top: -9999, left: 0 }}
          role="listbox"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          className="z-[9999] max-h-64 overflow-y-auto rounded-md border border-line bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
        >
          {options.length === 0 && (
            <li className="px-4 py-3 text-center text-[12px] text-ink-faint">موردی نیست</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition-colors",
                  o.disabled && "cursor-not-allowed opacity-40",
                  active === i ? "bg-paper-soft" : "bg-transparent",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate", isSelected ? "font-bold text-ink" : "text-ink/85")}>
                    {o.label}
                  </span>
                  {o.hint && <span className="truncate text-[10px] text-ink-faint">{o.hint}</span>}
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-ink" />}
              </li>
            );
          })}
        </motion.ul>
        )}
      </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// keep ts happy: nothing below
