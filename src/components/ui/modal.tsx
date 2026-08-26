"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib";

/**
 * Responsive dialog: centered modal on desktop, bottom sheet on mobile
 * (slides up, drag handle, drag-to-dismiss). Closes on backdrop/Esc.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Esc to close + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!ready) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/45"
          />
          {/* desktop: centered modal / mobile: bottom sheet */}
          <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] } }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 700) onClose();
              }}
              className={cn(
                "flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[86vh] sm:rounded-xl",
                wide ? "sm:max-w-2xl" : "sm:max-w-lg",
              )}
            >
              {/* drag handle (mobile affordance) */}
              <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
                <div className="h-1.5 w-10 rounded-full bg-line" />
              </div>

              {/* header */}
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-[14px] font-bold">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-[11px] text-ink-soft">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-paper-soft hover:text-ink"
                  aria-label="بستن"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

              {footer && (
                <div className="border-t border-line px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">{footer}</div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
