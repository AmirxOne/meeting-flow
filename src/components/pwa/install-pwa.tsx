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
 * Install-PWA offer — a dedicated full-width section near the landing
 * footer (removed from the hero). Native install prompt
 * (Chrome/Edge/Android) when available; platform instructions
 * otherwise. Dismiss remembered for 7 days.
 */
export function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return; // already installed
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

  if (hidden) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ type: "spring", stiffness: 160, damping: 24 }}
        className="relative overflow-hidden rounded-3xl bg-ink px-6 py-6 text-white shadow-[0_24px_60px_-24px_rgba(13,13,13,0.55)] sm:px-10 sm:py-8"
        dir="rtl"
      >
        {/* ambient decor */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 size-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col-reverse items-center gap-6 lg:flex-row lg:items-stretch lg:gap-12">
          {/* copy + actions */}
          <div className="flex min-w-0 flex-1 flex-col justify-center text-center lg:text-right">
            <p className="inline-flex items-center gap-1.5 self-center rounded-full bg-white/10 px-3 py-1 text-[10.5px] font-medium text-white/80 ring-1 ring-white/15 lg:self-start">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              وب‌اپلیکیشن — بدون نیاز به فروشگاه اپ
            </p>
            <h3 className="mt-2.5 text-[21px] font-bold leading-8 sm:text-[24px]">مهرسا را همیشه دم‌دست داشته باشید</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-white/70 lg:mx-0">
              روی گوشی یا دسکتاپ نصب کنید تا مهرسا مثل یک اپ‌لیکیشن مستقل، سریع و بدون مرورگر باز شود.
            </p>
            <ul className="mx-auto mt-4 grid max-w-md gap-2 text-right sm:grid-cols-2 lg:mx-0">
              {[
                { t: "باز شدن آنی", d: "بدون نوار مرورگر و صفحه‌ی تب" },
                { t: "کارکرد آفلاین", d: "صفحات دیده‌شده بدون اینترنت" },
                { t: "میان‌بر صفحه‌ی اصلی", d: "مثل هر اپ دیگری روی گوشی" },
                { t: "بدون به‌روزرسانی دستی", d: "همیشه آخرین نسخه در دسترس" },
              ].map((f) => (
                <li key={f.t} className="flex items-start gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
                  <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="text-[12px] font-bold">{f.t}</p>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-white/55">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <button
                onClick={() => void install()}
                className="flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-[13.5px] font-bold text-ink shadow-[0_6px_18px_-8px_rgba(255,255,255,0.45)] transition-shadow duration-200 hover:shadow-[0_14px_34px_-10px_rgba(255,255,255,0.55)] active:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {deferred ? "نصب برنامه" : "راهنمای نصب"}
              </button>
              <p className="text-[10.5px] leading-5 text-white/50">
                رایگان · چند ثانیه طول می‌کشد ·
                <span className="mx-1">{platform === "ios" ? "iPhone / iPad" : platform === "android" ? "اندروید" : "ویندوز / مک"}</span>
              </p>
            </div>
          </div>

          {/* phone mockup — realistic proportions (19.5:9), notch, side buttons */}
          <div className="relative mx-auto w-full max-w-[230px] shrink-0 sm:max-w-[260px] lg:mx-0 lg:w-[260px]">
            {/* glow behind the phone */}
            <div aria-hidden className="absolute inset-x-6 top-8 bottom-0 rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent blur-md" />

            {/* frame */}
            <div className="relative aspect-[9/21] rounded-[2.6rem] border border-white/25 bg-gradient-to-b from-white/[0.14] to-white/[0.04] p-[10px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-sm">
              {/* side buttons */}
              <span aria-hidden className="absolute -right-[2.5px] top-[17%] h-7 w-[3px] rounded-l-md bg-white/30" />
              <span aria-hidden className="absolute -right-[2.5px] top-[26%] h-11 w-[3px] rounded-l-md bg-white/30" />
              <span aria-hidden className="absolute -right-[2.5px] top-[34%] h-11 w-[3px] rounded-l-md bg-white/30" />
              <span aria-hidden className="absolute -left-[2.5px] top-[24%] h-14 w-[3px] rounded-r-md bg-white/30" />

              {/* screen */}
              <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-white" dir="rtl">
                {/* dynamic island */}
                <div aria-hidden className="absolute left-1/2 top-2 z-10 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-black" />

                {/* status bar */}
                <div className="flex items-center justify-between bg-ink px-5 pb-1 pt-2 text-[8px] text-white/90">
                  <span className="tabular-nums">۹:۴۱</span>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2 w-3 rounded-[2px] ring-1 ring-white/60" />
                    <span className="inline-block h-2 w-4 rounded-[2px] bg-white/70" />
                  </div>
                </div>

                {/* app header */}
                <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2.5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-[9px] font-bold text-white">م</span>
                  <div>
                    <p className="text-[10px] font-bold leading-4 text-ink">مهرسا</p>
                    <p className="text-[7.5px] leading-3 text-ink-faint">مدیریت جلسات سازمانی</p>
                  </div>
                  <span className="mr-auto size-1.5 rounded-full bg-emerald-500" />
                </div>

                {/* today list */}
                <div className="flex-1 space-y-1.5 overflow-hidden bg-paper-soft/40 p-2.5">
                  <p className="px-1 text-[8px] font-medium text-ink-faint">جلسات امروز — سه‌شنبه ۳۱ شهریور</p>
                  {[
                    { t: "هماهنگی هفتگی فروش", r: "اتاق آریا · ۱۰:۰۰", c: "bg-emerald-100 text-emerald-700" },
                    { t: "بازبینی محصول", r: "اتاق مدیریت · ۱۲:۳۰", c: "bg-amber-100 text-amber-700" },
                    { t: "کمیته‌ی کیفیت", r: "کنفرانس بزرگ · ۱۵:۰۰", c: "bg-sky-100 text-sky-700" },
                  ].map((m) => (
                    <div key={m.t} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm">
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${m.c}`}>
                        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-bold leading-4 text-ink">{m.t}</p>
                        <p className="truncate text-[7.5px] leading-3 text-ink-faint">{m.r}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* bottom nav */}
                <div className="flex items-center justify-around border-t border-line bg-white px-2 pb-3 pt-1.5 text-ink-faint">
                  {["خانه", "تقویم", "درخواست‌ها", "گزارش‌ها"].map((n, i) => (
                    <div key={n} className="flex flex-col items-center gap-0.5">
                      <span className={`h-3.5 w-3.5 rounded ${i === 0 ? "bg-ink" : "bg-ink/15"}`} />
                      <span className={`text-[6.5px] ${i === 0 ? "font-bold text-ink" : ""}`}>{n}</span>
                    </div>
                  ))}
                </div>
                {/* home indicator */}
                <div aria-hidden className="absolute bottom-1 left-1/2 h-[4px] w-[86px] -translate-x-1/2 rounded-full bg-ink/80" />
              </div>
            </div>
            <p className="mt-3 text-center text-[9.5px] text-white/40">مهرسا — روی صفحه‌ی اصلی گوشی شما</p>
          </div>
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
