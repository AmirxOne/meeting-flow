"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { NextStep, type Tour, type CardComponentProps } from "nextstepjs";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/lib/auth-store";
import { faNum } from "@/lib";
import { X, ChevronLeft } from "lucide-react";

/** Persisted "seen" tours per user — first visit auto-starts the matching tour. */
function useSeenTours(userId: string | undefined) {
  const key = `nextstep-seen:${userId ?? "anon"}`;
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    try {
      setSeen(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setSeen([]);
    }
  }, [key]);
  const markSeen = useCallback((tour: string) => {
    setSeen((prev) => {
      if (prev.includes(tour)) return prev;
      const next = [...prev, tour];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [key]);
  const reset = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setSeen([]);
  }, [key]);
  return { seen, markSeen, reset };
}

/**
 * مهرسا tour card — positioned NEXT TO the spotlighted element.
 * nextstepjs's own card wrapper breaks under transformed ancestors
 * (page transitions), so this card portals itself to <body> and
 * positions from the live target rect on every step/scroll/resize.
 */
function MehrsaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
}: CardComponentProps) {
  const isLast = currentStep === totalSteps - 1;
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => setMounted(true), []);

  // lock page scroll while the tour card is open — the page must not move
  // under the spotlight. Unlock briefly when the step changes so the
  // spotlight can scroll its target into view, then re-lock.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "";
    const t = setTimeout(() => {
      document.body.style.overflow = "hidden";
    }, 600); // nextstepjs scroll-into-view settles within ~500ms
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [mounted, currentStep]);

  // locate the currently-highlighted element (nextstepjs marks it)
  const locate = useCallback(() => {
    const sel = (step as { selector?: string }).selector;
    const el =
      (sel && document.querySelector(sel)) ||
      document.querySelector("[data-nextstep-highlight], .nextstep-highlight") ||
      // fallback: the element the overlay hole is cut around
      findHoleTarget();
    if (el) {
      const r = el.getBoundingClientRect();
      setTargetRect(r);
      const cardW = Math.min(320, window.innerWidth - 24);
      const cardH = 230;
      const margin = 16;

      // ── smart placement: try BELOW first, then whichever side has room.
      // The card must be FULLY inside the viewport — never clipped.
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const fits = (t: number, l: number) =>
        t >= 8 && l >= 8 && t + cardH <= vh - 8 && l + cardW <= vw - 8;

      // horizontally centered on the target as the base
      let baseLeft = Math.round(r.left + r.width / 2 - cardW / 2);
      baseLeft = Math.max(8, Math.min(baseLeft, vw - cardW - 8));

      const candidates: Array<{ top: number; left: number }> = [
        { top: r.bottom + margin, left: baseLeft }, // below (preferred)
        { top: r.top - cardH - margin, left: baseLeft }, // above
        { top: r.top + r.height / 2 - cardH / 2, left: r.right + margin }, // right side
        { top: r.top + r.height / 2 - cardH / 2, left: r.left - cardW - margin }, // left side
      ];

      let chosen = candidates[0];
      for (const c of candidates) {
        if (fits(c.top, c.left)) {
          chosen = c;
          break;
        }
      }
      // nothing fits perfectly (tiny viewport) → clamp into view
      const top = Math.max(8, Math.min(chosen.top, vh - cardH - 8));
      const left = Math.max(8, Math.min(chosen.left, vw - cardW - 8));
      setPos({ top, left });
    }
  }, [step]);

  useEffect(() => {
    locate();
    const t1 = setTimeout(locate, 350); // after nextstepjs scroll-into-view
    const t2 = setTimeout(locate, 900); // after our smooth nudge settles
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  }, [locate, currentStep]);

  const card = (
    <div
      dir="rtl"
      style={{
        width: 320,
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 9999,
        visibility: pos ? "visible" : "hidden",
      }}
      className="rounded-xl border border-line bg-white p-5 text-right shadow-2xl"
    >
      {/* connector line to the target */}
      {targetRect && pos && (
        <span
          aria-hidden
          className="pointer-events-none absolute bg-ink/20"
          style={connectorStyle(targetRect, pos)}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-bold text-ink">{step.title}</p>
        <button
          onClick={() => (skipTour ? skipTour() : nextStep())}
          aria-label="بستن"
          className="rounded-md p-1 text-ink-faint hover:bg-paper-soft hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1.5 text-[12px] leading-6 text-ink-soft">{step.content}</div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] text-ink-faint">
          {faNum(currentStep + 1)} از {faNum(totalSteps)}
        </span>
        <div className="flex items-center gap-1.5">
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="flex h-8 items-center gap-1 rounded-md border border-line px-3 text-[12px] text-ink-soft hover:bg-paper-soft"
            >
              قبلی
              <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}
          <button
            onClick={nextStep}
            className="flex h-8 items-center gap-1 rounded-md bg-ink px-3.5 text-[12px] font-medium text-white hover:bg-[#2a2a2e]"
          >
            {isLast ? "متوجه شدم" : "بعدی"}
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(card, document.body) : null;
}

/** nextstepjs cuts a hole in its overlay — find the element under the hole center. */
function findHoleTarget(): HTMLElement | null {
  return null; // positioning uses the step selector directly
}

/** little line connecting card → target edge */
function connectorStyle(target: DOMRect, pos: { top: number; left: number }) {
  const cardIsLeft = pos.left + 320 <= target.left + 40;
  const x1 = cardIsLeft ? pos.left + 320 : pos.left;
  const x2 = cardIsLeft ? target.left : target.right;
  const y1 = pos.top + 40;
  const y2 = target.top + target.height / 2;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    width: Math.max(0, len),
    height: 1,
    left: x1,
    top: y1,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "0 0",
  } as React.CSSProperties;
}

/** Tours per page — selectors match real elements in the app shell & pages. */
const TOURS: Tour[] = [
  {
    tour: "dashboard",
    steps: [
      {
        title: "خوش آمدید به مهرسا 🎉",
        content:
          "این راهنمای کوتاه (فقط همین بار) شما را با بخش‌های اصلی آشنا می‌کند. با «بعدی» ادامه دهید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: '[data-tour="nav"] > a:first-child',
        side: "right",
      },
      {
        title: "منوی اصلی",
        content:
          "از این‌جا به داشبورد، تقویم، جلسات، افراد و اتاق‌ها دسترسی دارید. گزینه‌ها بر اساس نقش شما نمایش داده می‌شوند.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: '[data-tour="nav"] > a:first-child',
        side: "right",
      },
      {
        title: "جستجوی سراسری",
        content:
          "هر چیزی را این‌جا جستجو کنید: جلسه، فرد، اتاق یا شعبه — بدون لازم بودن بدانید کجاست.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: '[data-tour="search"]',
        side: "bottom",
      },
      {
        title: "اعلان‌ها",
        content:
          "دعوت‌ها، تأییدها و یادآورهای جلسات این‌جا می‌آیند. روی هر اعلان بزنید تا مستقیم به جلسه‌اش بروید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: 'a[href="/notifications"]',
        side: "right",
      },
      {
        title: "ساخت جلسه جدید",
        content:
          "با این دکمه ویزارد ساخت جلسه باز می‌شود: افراد را انتخاب می‌کنید، سیستم زمان آزاد و اتاق مناسب را پیشنهاد می‌دهد.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: 'a[href="/meetings/new"]',
        side: "right",
      },
    ],
  },
  {
    tour: "calendar",
    steps: [
      {
        title: "تقویم مهرسا",
        content:
          "تقویم شمسی/میلادی با نمای ماه، هفته و روز. جلسات خودتان همیشه کامل دیده می‌شوند؛ جلسات محرمانه‌ی دیگران فقط به‌صورت «🔒 جلسه محرمانه».",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
      {
        title: "تغییر نما",
        content: "بین ماه / هفته / روز جابه‌جا شوید. روی هر روز کلیک کنید تا جزئیات جلسه‌هایش را ببینید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: '[data-tour="cal-views"]',
        side: "bottom",
      },
    ],
  },
  {
    tour: "meetings-list",
    steps: [
      {
        title: "لیست جلسات",
        content: "همه‌ی جلسه‌هایی که به آن‌ها دسترسی دارید این‌جا هستند. با فیلترها بر اساس وضعیت محدودشان کنید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "people",
    steps: [
      {
        title: "دایرکتوری افراد",
        content: "اعضای شرکت و ارتباط‌های خارجی این‌جا مدیریت می‌شوند — همان لیستی که هنگام ساخت جلسه برای انتخاب افراد استفاده می‌شود.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
      {
        title: "افزودن فرد",
        content: "عضو جدید شرکت یا مهمان خارجی اضافه کنید. حذف/ویرایش از همان ردیف جدول انجام می‌شود.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: '[data-tour="people-add"]',
        side: "bottom",
      },
    ],
  },
  {
    tour: "rooms",
    steps: [
      {
        title: "اتاق‌های جلسه",
        content: "وضعیت زنده‌ی همه‌ی اتاق‌ها — سبز: آزاد، قرمز: در حال برگزاری. روی هر اتاق بزنید تا تقویم و جزئیاتش را ببینید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "availability",
    steps: [
      {
        title: "زمان مناسب مشترک",
        content: "افراد را انتخاب کنید و بگویید جلسه چقدر طول می‌کشد — سیستم زمان‌هایی که همه آزادند و اتاق هم خالی است را پیشنهاد می‌دهد.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "reports",
    steps: [
      {
        title: "گزارش‌ها",
        content: "آمار جلسات در بازه‌ی دلخواه: تعداد، ساعت‌ها، نرخ لغو و استفاده‌ی اتاق‌ها — با خروجی CSV.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "notifications",
    steps: [
      {
        title: "اعلان‌ها",
        content: "دعوت‌ها، تأییدها، تغییر زمان/اتاق و یادآورها. روی هر اعلان بزنید تا مستقیم به جلسه‌اش بروید.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "branches",
    steps: [
      {
        title: "شعبه‌ها",
        content: "هر شعبه اتاق‌ها و کاربران خود را دارد — ساخت، ویرایش و مدیریت از همین صفحه.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "users",
    steps: [
      {
        title: "کاربران سیستم",
        content: "همه‌ی کاربران سازمان با نقش‌هایشان. مدیریت کامل (افزودن/ویرایش/غیرفعال‌سازی) از بخش مدیریت است.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "admin",
    steps: [
      {
        title: "بخش مدیریت",
        content: "آمار زنده‌ی سازمان، مدیریت کاربران/اتاق‌ها/سیاست‌ها و لاگ ممیزی — همه از همین‌جا.",
        pointerPadding: 0,
        pointerRadius: 8,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
];

/** Map pathname → tour name. */
function tourForPath(pathname: string): string | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname === "/meetings") return "meetings-list";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/people")) return "people";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/availability")) return "availability";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/branches")) return "branches";
  if (pathname.startsWith("/users")) return "users";
  return "dashboard"; // fallback: every page gets at least the general tour
}

/** Replay a tour from anywhere: window.dispatchEvent(new CustomEvent("mehrsa:replay-tour")) */
export function replayCurrentTour() {
  window.dispatchEvent(new CustomEvent("mehrsa:replay-tour"));
}

export function GuidedTours() {
  const pathname = usePathname();
  const me = useAuth((s) => s.me);
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { seen, markSeen, reset } = useSeenTours(me?.id);

  useEffect(() => {
    if (!me || isNextStepVisible) return;
    const tour = tourForPath(pathname);
    if (!tour || seen.includes(tour)) return;
    const t = setTimeout(() => {
      markSeen(tour);
      startNextStep(tour);
    }, 1200);
    return () => clearTimeout(t);
  }, [me, pathname, seen, isNextStepVisible, startNextStep, markSeen]);

  useEffect(() => {
    (window as unknown as { __resetTours?: () => void }).__resetTours = reset;
  }, [reset]);

  // user asked to see the guide again (header button)
  useEffect(() => {
    const onReplay = () => {
      const tour = tourForPath(pathname);
      if (!tour) return;
      startNextStep(tour);
    };
    window.addEventListener("mehrsa:replay-tour", onReplay);
    return () => window.removeEventListener("mehrsa:replay-tour", onReplay);
  }, [pathname, startNextStep]);

  return (
    <NextStep
      cardComponent={MehrsaCard}
      steps={TOURS}
      shadowRgb="13,13,13"
      shadowOpacity="0.55"
    >
      <></>
    </NextStep>
  );
}
