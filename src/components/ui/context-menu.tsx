"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * منوی راست‌کلیک کاستوم — portal به body، همان زبان طراحی پروژه.
 * 사용: <ContextMenu items={[{label, icon, onClick, danger, disabled}]}>{trigger}</ContextMenu>
 * یا کنترل‌شده: <ContextMenuOpen x={} y={} items={} onClose={} />
 */

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function ContextMenu({
  items,
  children,
  className = "",
}: {
  items: ContextMenuItem[];
  children: ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className={className}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {pos && <ContextMenuOpen x={pos.x} y={pos.y} items={items} onClose={() => setPos(null)} />}
    </div>
  );
}

export function ContextMenuOpen({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // رندر اول در جای خام ولی نامرئی — بعد از اندازه‌گیری clamp و نمایش
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);

  // clamp بعد از رندر نامرئی — useLayoutEffect تا قبل از paint دیده شود
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || adjusted) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + r.width > window.innerWidth - 8) nx = Math.max(8, window.innerWidth - r.width - 8);
    if (y + r.height > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - r.height - 8);
    setAdjusted({ x: nx, y: ny });
  });

  // بستن با کلیک بیرون / Esc / اسکرول — mousedown داخل خود منو نادیده گرفته می‌شود
  // (وگرنه منو قبل از رسیدن click به آیتم بسته می‌شود)
  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);



  if (typeof document === "undefined" || !mounted) return null;

  return createPortal(
    <div
      ref={ref}
      dir="rtl"
      role="menu"
      style={{ position: "fixed", top: (adjusted ?? { x, y }).y, left: (adjusted ?? { x, y }).x, zIndex: 10000, visibility: adjusted ? undefined : "hidden" }}
      className="min-w-52 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separatorBefore && <div className="my-1 h-px bg-line" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick?.(); }}
            className={
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
              (item.danger
                ? "text-red-600 hover:bg-red-50"
                : "text-ink-soft hover:bg-paper-soft hover:text-ink")
            }
          >
            <span className="flex h-4 w-4 items-center justify-center text-ink-faint">{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
