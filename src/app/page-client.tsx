"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  DoorOpen,
  Download,
  History,
  Layers,
  LifeBuoy,
  MessageCircle,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
} from "@/components/ui/icon";
import { FadeIn, StaggerItem, StaggerList } from "@/components/ui/motion";
import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import { InstallPwaBanner, InstallPwaButton } from "@/components/pwa/install-pwa";

/* ───────────────────────── content ───────────────────────── */

const HERO_STATS = [
  { value: "۶", label: "نقش سازمانی با دسترسی تفکیک‌شده" },
  { value: "۳", label: "لایه قفل ضد تداخل اتاق" },
  { value: "۲", label: "کانال پیامک و ایمیل واقعی" },
  { value: "۱۰۰٪", label: "فارسی، راست‌چین، تقویم شمسی" },
] as const;

const FEATURES: { icon: typeof CalendarPlus; title: string; desc: string; tag: string }[] = [
  {
    icon: CalendarPlus, tag: "هسته",
    title: "درخواست جلسه — حتی بدون ورود",
    desc: "کارمند نیازش را ثبت می‌کند (افراد، فوریت، مدت، بازه‌ی دلخواه، محرمانگی). مهمان بیرونی هم از صفحه‌ی عمومی، بدون حساب کاربری. تکرارشونده («هر هفته با همراه اول») هم همین‌جا.",
  },
  {
    icon: CalendarDays, tag: "هسته",
    title: "تقویم شمسی با درگ‌اند‌دراپ",
    desc: "جلسه را بکشید: روز دیگر، ساعت دیگر، اتاق دیگر — یا روی لبه‌ی تقویم بمانید تا ماه‌ها ورق بخورند. تأیید نهایی همیشه با تاریخ شمسی.",
  },
  {
    icon: Clock, tag: "هسته",
    title: "زمان‌بندی هوشمند و صف انتظار",
    desc: "زمان آزاد مشترکِ افراد پیشنهاد می‌شود؛ اگر اتاق پر بود جلسه وارد صف انتظار می‌شود و با آزادشدن، نوبتش خودکار پیشنهاد می‌گردد.",
  },
  {
    icon: UsersRound, tag: "مهمان‌ها",
    title: "مهمان بیرونی و دعوت‌نامه واقعی",
    desc: "مهمان‌های بیرونی با نام و سازمان ثبت می‌شوند و دعوت‌نامه‌ی پیامک/ایمیل واقعی می‌گیرند؛ ورود و خروجشان با کد چک‌این ثبت می‌شود.",
  },
  {
    icon: DoorOpen, tag: "اتاق‌ها",
    title: "QR زنده‌ی اتاق و تابلوی نمایش",
    desc: "هر اتاق QR اختصاصی دارد؛ اسکن کنید برنامه‌ی زنده با شمارش معکوس و نوار پیشرفت جلسه‌ی جاری را ببینید. تبلوی کنار در هم همان صفحه است.",
  },
  {
    icon: Layers, tag: "اسناد",
    title: "پیوست، دستور جلسه و صورت‌جلسه",
    desc: "فایل‌ها با اسکن امن آپلود می‌شوند؛ صورت‌جلسه با تصمیم‌ها و مسئول هر تصمیم، گردش پیش‌نویس→تأیید→نهایی دارد و محرمانگی هر بخش جدا تنظیم می‌شود.",
  },
  {
    icon: MessageCircle, tag: "اعلان",
    title: "یادآور و اعلان چندکاناله",
    desc: "دعوت، تغییر زمان/اتاق، لغو و یادآور چند دقیقه قبل — درون‌سامانه، پیامک کاوه‌نگار و ایمیل؛ هر کاربر ترجیح کانال خودش را دارد.",
  },
  {
    icon: BarChart3, tag: "گزارش",
    title: "گزارش شخصی و مدیریتی + خروجی",
    desc: "هر نفر آمار خودش را می‌بیند؛ مدیران نمودارهای روند، سهم شعبه‌ها و اشغال اتاق‌ها را با خروجی CSV، Excel و PDF تحویل می‌گیرند.",
  },
  {
    icon: History, tag: "تقویم بیرونی",
    title: "اشتراک تقویم (ICS)",
    desc: "هر کاربر فید اختصاصی Outlook/Google دارد؛ جلساتش خودکار در تقویم گوشی می‌نشیند — با توکن امن قابل ابطال.",
  },
  {
    icon: ShieldCheck, tag: "امنیت",
    title: "محرمانگی و کنترل دسترسی",
    desc: "عنوان جلسات محرمانه ماسک می‌شود؛ نقش‌ها، نمایندگی (به‌نام دیگری جلسه بگذارید) و تفکیک کامل بین سازمان‌ها و شعب.",
  },
  {
    icon: Shield, tag: "امنیت",
    title: "ورود دومرحله‌ای و سازمانی",
    desc: "2FA با اپ احرازکننده، ورود LDAP/SSO سازمانی، محدودیت تلاش ورود و بازیابی رمز امن — همه از قبل فعال.",
  },
  {
    icon: Sparkles, tag: "تجربه",
    title: "PWA و حالت آفلاین",
    desc: "روی گوشی نصب می‌شود، بدون اینترنت هم باز می‌شود و با وصل‌شدن دقیقاً به همان صفحه برمی‌گردد که بودید.",
  },
];

const STEPS = [
  { n: 1, title: "درخواست", desc: "کارمند یا مهمان نیاز را ثبت می‌کند: افراد، فوریت، مدت، بازه‌ی دلخواه و محرمانگی." },
  { n: 2, title: "هماهنگی", desc: "مدیریت از صف، زمانِ آزاد و اتاق مناسب را برمی‌گزیند — یا جلسه‌ی تکرارشونده می‌سازد." },
  { n: 3, title: "برگزاری", desc: "دعوت‌ها (پیامک/ایمیل) می‌رود، حضور ثبت می‌شود، تغییرات با درگ همان لحظه اعمال می‌شود." },
  { n: 4, title: "صورتجلسه و گزارش", desc: "دبیر صورت‌جلسه را ثبت و برای تأیید می‌فرستد؛ آمار در داشبورد و گزارش‌ها جمع می‌شود." },
] as const;

const TRUST = [
  { icon: ShieldCheck, text: "جلسات محرمانه با ماسک عنوان" },
  { icon: Users, text: "۶ نقش: از اپراتور تا مدیر شعبه" },
  { icon: Building2, text: "چندسازمانه، چندشعبه، چنداتاق" },
  { icon: CheckCircle2, text: "ورود سازمانی LDAP + 2FA" },
  { icon: LifeBuoy, text: "جستجوی سراسری و مرکز راهنما" },
  { icon: Download, text: "خروجی CSV / Excel / PDF" },
] as const;

const FOOTER_COLS = [
  {
    title: "امکانات",
    links: [
      { label: "درخواست جلسه", href: "/request" },
      { label: "تقویم شمسی", href: "#features" },
      { label: "QR اتاق‌ها", href: "#features" },
      { label: "گزارش و خروجی", href: "#features" },
    ],
  },
  {
    title: "گردش‌کار",
    links: [
      { label: "صف درخواست‌ها", href: "#workflow" },
      { label: "تأیید و نهایی‌سازی", href: "#workflow" },
      { label: "صورت‌جلسه", href: "#features" },
      { label: "اشتراک ICS", href: "#features" },
    ],
  },
  {
    title: "دسترسی",
    links: [
      { label: "ورود به سامانه", href: "/login" },
      { label: "درخواست مهمان", href: "/request" },
      { label: "امنیت و نقش‌ها", href: "#trust" },
      { label: "حریم خصوصی", href: "/privacy" },
    ],
  },
] as const;

/* ───────────────────────── pieces ───────────────────────── */

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={
          dark
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15"
            : "flex h-9 w-9 items-center justify-center rounded-lg bg-ink"
        }
      >
        <Image src="/logo-white.png" alt="مهرسا" width={24} height={24} className="h-6 w-6 object-contain" priority />
      </div>
      <div>
        <p className={dark ? "text-[14px] font-bold text-white" : "text-[14px] font-bold"}>مهرسا</p>
        <p className={dark ? "text-[10px] text-white/50" : "text-[10px] text-ink-faint"}>مدیریت جلسات سازمانی</p>
      </div>
    </div>
  );
}

function ProductPreview() {
  const meetings = [
    { time: "۱۰:۰۰", title: "جلسه هفتگی تیم فروش", room: "اتاق جلسه آریا", status: "قطعی", tone: "bg-emerald-100 text-emerald-700" },
    { time: "۱۱:۳۰", title: "ارائه به مشتری — همکاران همراه اول", room: "بیرون از شرکت", status: "بیرونی", tone: "bg-amber-100 text-amber-700" },
    { time: "۱۴:۳۰", title: "بازبینی بودجه فصل", room: "اتاق کنفرانس بزرگ", status: "قطعی", tone: "bg-emerald-100 text-emerald-700" },
  ];
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-l from-ink/5 to-transparent blur-xl" />
      <div className="relative rounded-2xl border border-line bg-white p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-white">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <p className="text-[12px] font-bold">برنامه‌ی امروز</p>
              <p className="text-[10px] text-ink-faint">اتاق کنفرانس بزرگ · ۲۹ شهریور ۱۴۰۵</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-medium text-emerald-600">● زنده</span>
        </div>
        {/* timeline */}
        <div className="relative mt-4 h-2 rounded-full bg-paper-soft">
          <div className="absolute right-[8%] h-full w-[28%] rounded-full bg-emerald-400/70" title="۱۰:۰۰ فروش" />
          <div className="absolute right-[55%] h-full w-[18%] rounded-full bg-ink/20" title="۱۴:۳۰ بودجه" />
          <div className="absolute right-[30%] top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow" title="الان" />
        </div>
        <div className="mt-1 flex justify-between px-0.5 text-[8.5px] text-ink-faint">
          <span>۸</span><span>۱۱</span><span>۱۴</span><span>۱۷</span><span>۲۰</span>
        </div>
        <ul className="mt-3 space-y-2">
          {meetings.map((m) => (
            <li key={m.time} className="flex items-center gap-3 rounded-xl border border-line/70 bg-paper-soft/50 px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[10.5px] font-bold tabular-nums shadow-sm">{m.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">{m.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink-faint">{m.room}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium ${m.tone}`}>{m.status}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink px-3 py-2.5 text-white">
          <p className="text-[10.5px] text-white/70">جلسه‌ی جاری · ۲۵ دقیقه تا پایان</p>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function LandingPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-white">
      {/* ── header: sticky glass ── */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <BrandMark />
          <nav className="hidden items-center gap-6 text-[12.5px] text-ink-soft md:flex">
            <a href="#features" className="transition-colors hover:text-ink">امکانات</a>
            <a href="#workflow" className="transition-colors hover:text-ink">گردش‌کار</a>
            <a href="#trust" className="transition-colors hover:text-ink">امنیت</a>
          </nav>
          <div className="flex items-center gap-2">
            <InstallPwaButton className="hidden md:flex" />
            <Link
              href="/request"
              className="hidden h-10 items-center rounded-lg border border-line bg-white px-4 text-[13px] font-medium text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink sm:flex sm:px-5"
            >
              درخواست جلسه
            </Link>
            <Link
              href="/login"
              className="flex h-10 items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-white transition-all hover:bg-[#2a2a2e] hover:shadow-lg sm:px-5"
            >
              ورود به سامانه
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── hero ── */}
        <section className="relative overflow-hidden border-b border-line">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-paper-soft" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)", backgroundSize: "22px 22px" }} />
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/4 size-[28rem] rounded-full bg-ink/[0.04] blur-3xl" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-24">
            <FadeIn>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-ink-soft shadow-sm">
                <Sparkles className="size-3.5 text-ink" />
                سامانه‌ی فارسی مدیریت جلسات سازمانی
              </span>
              <h1 className="mt-5 text-[28px] font-bold leading-[1.4] sm:text-[38px] lg:text-[42px]">
                زمان سازمان را از پراکندگی
                <br />
                به <span className="relative inline-block">نظم<span aria-hidden className="absolute inset-x-0 bottom-1 -z-10 h-2.5 rounded-sm bg-emerald-200/60" /></span> تبدیل کنید
              </h1>
              <p className="mt-4 max-w-lg text-[14px] leading-8 text-ink-soft">
                مهرسا کل چرخه‌ی جلسه را پوشش می‌دهد: درخواست، هماهنگی، دعوت‌نامه‌ی پیامک و ایمیل،
                برگزاری با QR اتاق، صورت‌جلسه‌ی محرمانه و گزارش مدیریتی — همه فارسی، راست‌چین و با تقویم شمسی.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/request" className="flex h-12 items-center rounded-lg bg-ink px-7 text-[14px] font-medium text-white transition-all hover:bg-[#2a2a2e] hover:shadow-xl">
                  درخواست جلسه (بدون ورود)
                </Link>
                <Link href="/login" className="flex h-12 items-center rounded-lg border border-line bg-white px-7 text-[14px] text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink">
                  ورود به سامانه
                </Link>
                <a href="#features" className="flex h-12 items-center gap-1.5 rounded-lg px-4 text-[13.5px] text-ink-soft transition-colors hover:text-ink">
                  همه‌ی امکانات
                  <svg viewBox="0 0 24 24" className="size-4 rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </div>
              <dl className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
                {HERO_STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[22px] font-bold tabular-nums">{s.value}</dt>
                    <dd className="mt-1 text-[10.5px] leading-4 text-ink-soft">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </FadeIn>
            <FadeIn delay={0.08} className="lg:ps-4">
              <ProductPreview />
            </FadeIn>
          </div>
        </section>

        {/* ── features ── */}
        <section id="features" className="scroll-mt-20 bg-white px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-[12px] font-medium text-ink-faint">امکانات</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">
                هرآنچه عملیات جلسه نیاز دارد — در یک سامانه
              </h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                از رزرو تا گزارش هیئت‌مدیره؛ بدون اکسل موازی، بدون تداخل اتاق، بدون ابهام در دسترسی.
              </p>
            </div>
            <StaggerList className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <StaggerItem key={f.title}>
                  <article className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_12px_30px_-14px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-white transition-colors group-hover:bg-emerald-600">
                        <f.icon className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-paper-soft px-2 py-0.5 text-[9.5px] font-medium text-ink-faint">{f.tag}</span>
                    </div>
                    <h3 className="mt-4 text-[14px] font-bold">{f.title}</h3>
                    <p className="mt-2 text-[12.5px] leading-7 text-ink-soft">{f.desc}</p>
                  </article>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </section>

        {/* ── workflow ── */}
        <section id="workflow" className="scroll-mt-20 border-y border-line bg-paper-soft/60 px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-xl">
              <p className="text-[12px] font-medium text-ink-faint">گردش‌کار</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">از درخواست تا گزارش، یک مسیر مشخص</h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                هر نقش دقیقاً می‌داند چه زمانی وارد می‌شود — کارمند درخواست می‌دهد، اپراتور می‌چیند، مدیر تأیید می‌کند.
              </p>
            </div>
            <ol className="relative mt-10 grid gap-3 md:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="relative rounded-xl border border-line bg-white p-5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">{["۱", "۲", "۳", "۴"][s.n - 1]}</span>
                  <h3 className="mt-3 text-[14px] font-bold">{s.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-7 text-ink-soft">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── trust ── */}
        <section id="trust" className="scroll-mt-20 bg-white px-5 py-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium text-ink-faint">امنیت و دسترسی</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">
                مناسب سازمان‌هایی که محرمانگی برایشان مهم است
              </h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                عنوان جلسات محرمانه فقط برای برگزارکننده، دعوت‌شده و مدیر ارشد دیده می‌شود.
                ورود محلی یا سازمانی (LDAP) با ایمیل یا شماره موبایل — و دومرحله‌ای برای حساس‌ترین نقش‌ها.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {TRUST.map((t) => (
                  <li key={t.text} className="flex items-center gap-2.5 text-[12.5px] font-medium">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <t.icon className="size-3.5" />
                    </span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-paper-soft/50 p-6">
              <p className="text-[12px] font-bold text-ink-soft">نقش‌های سامانه</p>
              <ul className="mt-3 space-y-2 text-[12px]">
                {[
                  ["مدیر سازمان", "تنظیمات، نقش‌ها، همه‌ی جلسات و گزارش‌ها"],
                  ["اپراتور جلسات", "صف درخواست‌ها، تأیید و زمان‌بندی"],
                  ["مدیر شعبه", "اتاق‌ها و جلسات شعبه‌ی خودش"],
                  ["مسئول اتاق", "برنامه‌ی اتاق و جلسات مرتبط"],
                  ["کارمند", "درخواست جلسه، تقویم و جلسات خودش"],
                  ["دبیر جلسه", "ثبت صورت‌جلسه و پیگیری تصمیم‌ها"],
                ].map(([r, d]) => (
                  <li key={r} className="flex items-start gap-3 rounded-lg bg-white px-3 py-2.5">
                    <UserRound className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                    <p><span className="font-bold">{r}</span><span className="text-ink-soft"> — {d}</span></p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-5 pb-20">
          <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-ink px-8 py-12 text-white sm:px-10">
            <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 size-80 rounded-full bg-white/5 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-[22px] font-bold">آماده‌ی نظم‌دادن به جلسات سازمان هستید؟</h2>
                <p className="mt-2 max-w-md text-[13px] leading-7 text-white/65">
                  از داشبورد تا اولین رزرو کمتر از چند دقیقه. یا همین حالا بدون ورود، درخواست جلسه بدهید.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link href="/request" className="flex h-12 items-center rounded-lg bg-white px-7 text-[14px] font-medium text-ink transition-colors hover:bg-paper-soft">
                  درخواست جلسه (بدون ورود)
                </Link>
                <Link href="/login" className="flex h-12 items-center rounded-lg border border-white/25 px-7 text-[14px] text-white/85 transition-colors hover:bg-white/10">
                  ورود به سامانه
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── install app: dedicated offer ── */}
      <section className="px-5 pb-4">
        <div className="mx-auto w-full max-w-6xl">
          <InstallPwaBanner />
        </div>
      </section>

      {/* ── footer: multi-column ── */}
      <footer className="border-t border-line bg-paper-soft/40 px-5 pb-8 pt-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <BrandMark />
              <p className="mt-4 max-w-xs text-[12px] leading-6 text-ink-soft">
                سامانه‌ی فارسی مدیریت جلسات سازمانی — درخواست، هماهنگی، برگزاری، صورت‌جلسه و گزارش؛ برای شعب و تیم‌های عملیاتی.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-faint">
                <Phone className="size-3.5" />
                <span>پشتیبانی: از طریق سامانه‌ی پشتیبانی سازمان</span>
              </div>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="text-[12.5px] font-bold">{col.title}</p>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-[12px] text-ink-soft transition-colors hover:text-ink">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
            <p className="text-[11px] text-ink-faint">© مهرسا — سامانه مدیریت جلسات سازمانی</p>
            <LegalFooterLinks className="justify-start sm:justify-end" />
          </div>
        </div>
      </footer>
    </div>
  );
}
