"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const IOS_STEPS = [
  "دکمه‌ی Share (اشتراک‌گذاری □↑) را در نوار پایین Safari بزنید",
  "گزینه‌ی «Add to Home Screen / افزودن به صفحه‌ی اصلی» را انتخاب کنید",
  "با «Add» تأیید کنید — مهرسا مثل یک اپ مستقل نصب می‌شود",
];

/**
 * Install-PWA offer. Shows:
 *  - a banner on the landing hero (dismissable, remembered for 7 days)
 *  - a header button variant
 * Native install prompt (Chrome/Edge/Android) when available; otherwise
 * platform-specific instructions (iOS Safari / desktop address bar).
 */
export function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    try {
      if (localStorage.getItem("mehrsa-install-dismissed")) {
        const at = Number(localStorage.getItem("mehrsa-install-dismissed") ?? 0);
        if (Date.now() - at < 7 * 86400000) return; // dismissed within 7 days
      }
    } catch { /* private mode */ }
    setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setHidden(true));
    setPlatform(detectPlatform());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setHidden(true);
      setDeferred(null);
      return;
    }
    setShowManual(true); // iOS Safari / browsers without the native prompt
  };

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("mehrsa-install-dismissed", String(Date.now())); } catch { /* ignore */ }
  };

  if (hidden) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3.5 shadow-[0_10px_30px_-14px_rgba(13,13,13,0.3)]"
        dir="rtl"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <path d="M12 18h.01" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold">مهرسا را نصب کنید</p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-ink-soft">
              مثل یک اپ واقعی روی گوشی و دسکتاپ — سریع‌تر باز می‌شود و آفلاین هم در دسترس است
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void install()}
            className="h-9 rounded-lg bg-ink px-4 text-[12px] font-medium text-white transition-all hover:bg-[#2a2a2e] hover:shadow-md"
          >
            {deferred ? "نصب برنامه" : "راهنمای نصب"}
          </button>
          <button
            onClick={dismiss}
            aria-label="بستن"
            className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-paper-soft hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </motion.div>

      {/* manual instructions (iOS / no native prompt) */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
            onClick={() => setShowManual(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
              className="w-[400px] max-w-full rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-[15px] font-bold">نصب مهرسا</h3>
                <button
                  onClick={() => setShowManual(false)}
                  aria-label="بستن"
                  className="flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-soft"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {platform === "ios" ? (
                <ol className="mt-4 space-y-3">
                  {IOS_STEPS.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-[12.5px] leading-6 text-ink-soft">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">{["۱", "۲", "۳"][i]}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-4 space-y-3 text-[12.5px] leading-6 text-ink-soft">
                  <p className="flex items-start gap-2.5 rounded-xl bg-paper-soft px-3 py-2.5">
                    <span className="mt-0.5">🖥</span>
                    <span><b className="text-ink">دسکتاپ (Chrome/Edge):</b> روی آیکون نصب <span dir="ltr" className="inline-block">⊕</span> در انتهای نوار آدرس بزنید، یا منوی <span dir="ltr">⋮</span> ← «Install app / نصب برنامه».</span>
                  </p>
                  <p className="flex items-start gap-2.5 rounded-xl bg-paper-soft px-3 py-2.5">
                    <span className="mt-0.5">🤖</span>
                    <span><b className="text-ink">اندروید:</b> منوی مرورگر <span dir="ltr">⋮</span> ← «Add to Home screen / افزودن به صفحه‌ی اصلی».</span>
                  </p>
                </div>
              )}

              <p className="mt-4 text-center text-[10.5px] text-ink-faint">
                پس از نصب، مهرسا از خانه‌ی گوشی یا دسکتاپ مثل یک اپ مستقل باز می‌شود
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Compact header variant — shows only when installable, always clickable. */
export function InstallPwaButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setPlatform(detectPlatform());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (isStandalone()) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
      return;
    }
    setShowManual(true);
  };

  return (
    <>
      <button
        onClick={() => void install()}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink",
          className,
        )}
        dir="rtl"
        title="نصب مهرسا روی گوشی یا دسکتاپ"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" strokeLinecap="round" />
        </svg>
        نصب برنامه
      </button>
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
            onClick={() => setShowManual(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
              className="w-[400px] max-w-full rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3 className="text-[15px] font-bold">نصب مهرسا</h3>
              {platform === "ios" ? (
                <ol className="mt-4 space-y-3">
                  {IOS_STEPS.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-[12.5px] leading-6 text-ink-soft">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">{["۱", "۲", "۳"][i]}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-4 space-y-3 text-[12.5px] leading-6 text-ink-soft">
                  <p className="rounded-xl bg-paper-soft px-3 py-2.5">
                    <b className="text-ink">دسکتاپ:</b> آیکون <span dir="ltr">⊕</span> در نوار آدرس یا منوی <span dir="ltr">⋮</span> ← Install app
                  </p>
                  <p className="rounded-xl bg-paper-soft px-3 py-2.5">
                    <b className="text-ink">اندروید:</b> منوی <span dir="ltr">⋮</span> ← Add to Home screen
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
