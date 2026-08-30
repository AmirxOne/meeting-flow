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

/** Freeze page scroll while a guided tour is open.
 *  Uses position:fixed so nextstepjs scrollIntoView cannot jump the page (e.g. to h1). */
function useTourScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    const blockUserScroll = (e: Event) => e.preventDefault();
    const blockScroll = () => window.scrollTo(0, scrollY);

    window.addEventListener("wheel", blockUserScroll, { passive: false });
    window.addEventListener("touchmove", blockUserScroll, { passive: false });
    window.addEventListener("scroll", blockScroll, true);

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      window.removeEventListener("wheel", blockUserScroll);
      window.removeEventListener("touchmove", blockUserScroll);
      window.removeEventListener("scroll", blockScroll, true);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

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

  useEffect(() => setMounted(true), []);

  // locate the currently-highlighted element (nextstepjs marks it)
  const locate = useCallback(() => {
    const sel = (step as { selector?: string }).selector;
    const el =
      (sel && document.querySelector(sel)) ||
      document.querySelector("[data-nextstep-highlight], .nextstep-highlight");
    if (el) {
      const r = el.getBoundingClientRect();
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
      className="rounded-xl border border-line bg-white p-3 text-right shadow-2xl"
    >
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

/** Radius proportional to target size — flat on wide bars (h1), softer on square buttons. */
export function spotlightRadiusFor(el: Element, padding = 0): number {
  const { width, height } = el.getBoundingClientRect();
  const w = Math.max(width + padding, 1);
  const h = Math.max(height + padding, 1);
  const minDim = Math.min(w, h);
  const aspect = Math.max(w, h) / minDim;
  const factor = aspect > 3 ? 0.1 : aspect > 1.8 ? 0.12 : 0.18;
  return Math.max(2, Math.min(8, Math.round(minDim * factor)));
}

function patchStepRadius(tours: Tour[], tourId: string, stepIndex: number, radius: number): Tour[] {
  const tourIdx = tours.findIndex((t) => t.tour === tourId);
  if (tourIdx < 0) return tours;
  const step = tours[tourIdx].steps[stepIndex];
  if (!step || step.pointerRadius === radius) return tours;

  return tours.map((t, ti) =>
    ti !== tourIdx
      ? t
      : {
          ...t,
          steps: t.steps.map((s, si) =>
            si === stepIndex ? { ...s, pointerRadius: radius } : s,
          ),
        },
  );
}

/** Re-measure the highlighted element and push a fitting pointerRadius into nextstepjs. */
function useDynamicTourSteps(
  baseTours: Tour[],
  active: boolean,
  tourId: string | null,
  stepIndex: number,
): Tour[] {
  const [steps, setSteps] = useState(baseTours);

  useEffect(() => {
    setSteps(baseTours);
  }, [baseTours]);

  useEffect(() => {
    if (!active || !tourId) {
      setSteps(baseTours);
      return;
    }

    const tour = baseTours.find((t) => t.tour === tourId);
    const step = tour?.steps[stepIndex];
    if (!step?.selector) return;

    const measure = () => {
      const el = document.querySelector(step.selector!);
      if (!el) return;
      const padding = step.pointerPadding ?? 0;
      const radius = spotlightRadiusFor(el, padding);
      setSteps((prev) => patchStepRadius(prev, tourId, stepIndex, radius));
    };

    measure();
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 450);

    const el = document.querySelector(step.selector);
    const ro = el ? new ResizeObserver(measure) : undefined;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, tourId, stepIndex, baseTours]);

  return steps;
}

/** Spotlight padding — radius is computed dynamically from the target element. */
const TOUR_SPOT = { pointerPadding: 0, pointerRadius: 4 } as const;

/** Tours per page — selectors match real elements in the app shell & pages. */
const TOURS: Tour[] = [
  {
    tour: "dashboard",
    steps: [
      {
        title: "خوش آمدید به مهرسا 🎉",
        content:
          "این راهنمای کوتاه (فقط همین بار) شما را با بخش‌های اصلی آشنا می‌کند. با «بعدی» ادامه دهید.",
        ...TOUR_SPOT,
        selector: '[data-tour="nav"] > a:first-child',
        side: "right",
      },
      {
        title: "منوی اصلی",
        content:
          "از این‌جا به داشبورد، تقویم، جلسات، افراد و اتاق‌ها دسترسی دارید. گزینه‌ها بر اساس نقش شما نمایش داده می‌شوند.",
        ...TOUR_SPOT,
        selector: '[data-tour="nav"] > a:first-child',
        side: "right",
      },
      {
        title: "جستجوی سراسری",
        content:
          "هر چیزی را این‌جا جستجو کنید: جلسه، فرد، اتاق یا شعبه — بدون لازم بودن بدانید کجاست.",
        ...TOUR_SPOT,
        selector: '[data-tour="search"]',
        side: "bottom",
      },
      {
        title: "اعلان‌ها",
        content:
          "دعوت‌ها، تأییدها و یادآورهای جلسات این‌جا می‌آیند. روی هر اعلان بزنید تا مستقیم به جلسه‌اش بروید.",
        ...TOUR_SPOT,
        selector: 'a[href="/notifications"]',
        side: "right",
      },
      {
        title: "ساخت جلسه جدید",
        content:
          "با این دکمه ویزارد ساخت جلسه باز می‌شود: افراد را انتخاب می‌کنید، سیستم زمان آزاد و اتاق مناسب را پیشنهاد می‌دهد.",
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
        selector: "h1",
        side: "bottom",
      },
      {
        title: "تغییر نما",
        content: "بین ماه / هفته / روز جابه‌جا شوید. روی هر روز کلیک کنید تا جزئیات جلسه‌هایش را ببینید.",
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
        selector: "h1",
        side: "bottom",
      },
      {
        title: "افزودن فرد",
        content: "عضو جدید شرکت یا مهمان خارجی اضافه کنید. حذف/ویرایش از همان ردیف جدول انجام می‌شود.",
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
        selector: "h1",
        side: "bottom",
      },
    ],
  },
  {
    tour: "users",
    steps: [
      {
        title: "کاربران",
        content:
          "فهرست همکاران سازمان — نام، نقش و شعبه. افزودن یا ویرایش کاربران فقط از بخش «مدیریت → کاربران» در دسترس مدیران است.",
        ...TOUR_SPOT,
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
        ...TOUR_SPOT,
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
  const { startNextStep, isNextStepVisible, currentTour, currentStep } = useNextStep();
  const { seen, markSeen, reset } = useSeenTours(me?.id);
  const tourSteps = useDynamicTourSteps(TOURS, isNextStepVisible, currentTour, currentStep);

  useTourScrollLock(isNextStepVisible);

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
      steps={tourSteps}
      shadowRgb="13,13,13"
      shadowOpacity="0.55"
    >
      <></>
    </NextStep>
  );
}
