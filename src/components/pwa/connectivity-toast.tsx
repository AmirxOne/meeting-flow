"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Global connectivity toast — tells the user the moment their internet
 * drops («اینترنت خود را بررسی کنید») and confirms when it's back.
 * Purely additive: listeners on online/offline + a slow periodic probe
 * so router-level stalls are also caught (browsers fire `offline` only
 * when the OS interface is down).
 */
export function ConnectivityToast() {
  const [offline, setOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const timerRef = useRef<number | null>(null);

  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const goOffline = () => {
      wasOfflineRef.current = true;
      setOffline(true);
      setWasOffline(true);
    };
    const goOnline = () => setOffline(false);

    // light probe every 30s: catches "wifi connected but no internet" too
    const probe = async () => {
      try {
        await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(4000) });
        if (wasOfflineRef.current) goOnline();
        wasOfflineRef.current = false;
      } catch {
        if (!navigator.onLine || wasOfflineRef.current) goOffline();
      }
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    timerRef.current = window.setInterval(probe, 30_000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // remember offline state; auto-hide the "back online" note after ~3s
  useEffect(() => {
    if (offline) {
      setWasOffline(true);
      return;
    }
    if (!wasOffline) return;
    const t = window.setTimeout(() => setWasOffline(false), 3000);
    return () => window.clearTimeout(t);
  }, [offline, wasOffline]);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          dir="rtl"
          className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-3"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2.5 rounded-2xl bg-amber-500 px-4 py-2.5 text-white shadow-[0_10px_36px_-8px_rgba(245,158,11,0.6)]">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
            </span>
            <div className="text-right">
              <p className="text-[12.5px] font-bold leading-5">اتصال اینترنت قطع است</p>
              <p className="text-[11px] leading-4 text-white/85">اینترنت خود را بررسی کنید — تا وصل شود منتظر می‌مانیم</p>
            </div>
            <svg viewBox="0 0 24 24" className="size-4.5 shrink-0 text-white/90" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m2 2 20 20" strokeLinecap="round" />
            </svg>
          </div>
        </motion.div>
      )}
      {!offline && wasOffline && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          dir="rtl"
          className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-3"
          role="status"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-white shadow-lg">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[12.5px] font-bold">اینترنت وصل شد — ادامه بدهید</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
