"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { NextStep, type Tour, type CardComponentProps } from "nextstepjs";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/lib/auth-store";
import { cn, faNum } from "@/lib";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

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
  const markSeen = (tour: string) => {
    setSeen((prev) => {
      if (prev.includes(tour)) return prev;
      const next = [...prev, tour];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const reset = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setSeen([]);
  };
  return { seen, markSeen, reset };
}

/** مهرسا-styled tour card (RTL, Persian digits). */
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
  useEffect(() => setMounted(true), []);
  const card = (
    <div
      dir="rtl"
      style={{ width: 320, position: "fixed", bottom: 24, left: 24, zIndex: 9999 }}
      className="rounded-xl border border-line bg-white p-5 text-right shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-bold text-ink">{step.title}</p>
        <button onClick={() => (skipTour ? skipTour() : nextStep())} aria-label="بستن" className="rounded-md p-1 text-ink-faint hover:bg-paper-soft hover:text-ink">
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
              <ChevronLeft className="h-3.5 w-3.5" />
              قبلی
            </button>
          )}
          <button
            onClick={nextStep}
            className="flex h-8 items-center gap-1 rounded-md bg-ink px-3.5 text-[12px] font-medium text-white hover:bg-[#2a2a2e]"
          >
            {isLast ? "متوجه شدم" : "بعدی"}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
  return mounted ? createPortal(card, document.body) : null;
}

/** Tours per page — selectors match real elements in the app shell & pages. */
const TOURS: Tour[] = [
  {
    tour: "dashboard",
    steps: [
      {
        title: "خوش آمدید به مهرسا 🎉",
        content: "این راهنمای کوتاه (فقط همین بار نمایش داده می‌شود) شما را با بخش‌های اصلی آشنا می‌کند. با «بعدی» ادامه دهید.",
        selector: '[data-tour="nav"]',
        side: "left",
      },
      {
        title: "منوی اصلی",
        content: "از این‌جا به داشبورد، تقویم، جلسات، افراد و اتاق‌ها دسترسی دارید. گزینه‌ها بر اساس نقش شما نمایش داده می‌شوند.",
        selector: '[data-tour="nav"]',
        side: "left",
      },
      {
        title: "جستجوی سراسری",
        content: "هر چیزی را این‌جا جستجو کنید: جلسه، فرد، اتاق یا شعبه — بدون لازم بودن بدانید کجاست.",
        selector: '[data-tour="search"] input',
        side: "bottom",
      },
      {
        title: "اعلان‌ها",
        content: "دعوت‌ها، تأییدها و یادآورهای جلسات این‌جا می‌آیند. روی هر اعلان بزنید تا مستقیم به جلسه‌اش بروید.",
        selector: 'a[href="/notifications"]',
        side: "left",
      },
      {
        title: "ساخت جلسه جدید",
        content: "با این دکمه ویزارد ساخت جلسه باز می‌شود: افراد را انتخاب می‌کنید، سیستم زمان آزاد و اتاق مناسب را پیشنهاد می‌دهد.",
        selector: 'a[href="/meetings/new"]',
        side: "left",
      },
    ],
  },
  {
    tour: "calendar",
    steps: [
      {
        title: "تقویم مهرسا",
        content: "تقویم شمسی/میلادی با نمای ماه، هفته و روز. جلسات خودتان همیشه کامل دیده می‌شوند؛ جلسات محرمانه دیگران فقط به‌صورت «🔒 جلسه محرمانه».",
        selector: 'h1',
        side: "bottom",
      },
      {
        title: "تغییر نما",
        content: "بین ماه / هفته / روز جابه‌جا شوید. روی هر روز کلیک کنید تا جزئیات جلسه‌هایش را ببینید.",
        selector: "[data-tour=\"cal-views\"]",
        side: "bottom",
      },
    ],
  },
  {
    tour: "meetings-list",
    steps: [
      {
        title: "لیست جلسات",
        content: "همه‌ی جلسه‌ای که به آن‌ها دسترسی دارید این‌جا هستند. با فیلترها بر اساس وضعیت محدودشان کنید.",
        selector: "[data-tour=\"nav\"]",
        side: "top",
      },
    ],
  },
  {
    tour: "admin",
    steps: [
      {
        title: "بخش مدیریت",
        content: "آمار زنده‌ی سازمان، مدیریت کاربران/اتاق‌ها/سیاست‌ها و لاگ ممیزی — همه از همین‌جا.",
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
  return null;
}

export function GuidedTours() {
  const pathname = usePathname();
  const me = useAuth((s) => s.me);
  const { startNextStep, isNextStepVisible } = useNextStep();
  const { seen, markSeen, reset } = useSeenTours(me?.id);

  // auto-start on first-ever visit per (user, tour)
  useEffect(() => {
    if (!me || isNextStepVisible) return;
    const tour = tourForPath(pathname);
    if (!tour || seen.includes(tour)) return;
    const t = setTimeout(() => {
      markSeen(tour);
      startNextStep(tour);
    }, 1200); // let page content settle
    return () => clearTimeout(t);
  }, [me, pathname, seen, isNextStepVisible, startNextStep, markSeen]);

  // dev/testing helper — reset tours from console
  useEffect(() => {
    (window as unknown as { __resetTours?: () => void }).__resetTours = reset;
  }, [reset]);

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
