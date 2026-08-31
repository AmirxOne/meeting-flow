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
  DoorOpen,
  ShieldCheck,
  Users,
} from "@/components/ui/icon";
import { FadeIn, StaggerItem, StaggerList } from "@/components/ui/motion";
import { faNum } from "@/lib/fa";

const FEATURES = [
  {
    icon: CalendarPlus,
    title: "رزرو هوشمند اتاق",
    desc: "زمان آزاد دعوت‌شدگان و اتاق مناسب به‌صورت خودکار پیشنهاد می‌شود — بدون رفت‌وبرگشت پیام.",
  },
  {
    icon: DoorOpen,
    title: "بدون تداخل اتاق",
    desc: "قفل سه‌لایه در پایگاه داده؛ دو جلسه در یک اتاق و یک بازه ممکن نیست.",
  },
  {
    icon: CalendarDays,
    title: "تقویم شمسی رسمی",
    desc: "نمای ماه، هفته و روز با تقویم ICU ایران — تاریخ‌ها همان‌طور که سازمان می‌خواند.",
  },
  {
    icon: CheckCircle2,
    title: "گردش‌کار تأیید",
    desc: "جلسات مهمان‌دار، VIP و بین‌شعبه‌ای تا تأیید اپراتور یا مدیر قطعی نمی‌شوند.",
  },
  {
    icon: Bell,
    title: "اعلان و یادآور",
    desc: "دعوت، تغییر زمان یا اتاق، و یادآور چند دقیقه قبل از جلسه — درون‌سامانه، پیامک و ایمیل.",
  },
  {
    icon: BarChart3,
    title: "گزارش مدیریتی",
    desc: "ساعت جلسات، بهره‌برداری اتاق‌ها و نرخ لغو — با خروجی CSV برای هیئت‌مدیره.",
  },
] as const;

const STEPS = [
  { n: 1, title: "ثبت درخواست", desc: "موضوع، افراد، شعبه و بازهٔ زمانی را در چند قدم مشخص کنید." },
  { n: 2, title: "تأیید و تخصیص", desc: "اتاق آزاد قفل می‌شود؛ جلسات حساس مسیر تأیید سازمانی را طی می‌کنند." },
  { n: 3, title: "برگزاری", desc: "دعوت‌شدگان اعلان می‌گیرند، حضور ثبت می‌شود و تغییرات همان لحظه می‌رسند." },
  { n: 4, title: "گزارش", desc: "پس از جلسه، دادهٔ مصرف اتاق و زمان در گزارش‌های مدیریتی جمع می‌شود." },
] as const;

const STATS = [
  { value: "۶", label: "نقش دسترسی سازمانی" },
  { value: "۳", label: "لایه جلوگیری از تداخل" },
  { value: "۱۰۰٪", label: "تقویم و اعداد فارسی" },
] as const;

const TRUST = [
  { icon: ShieldCheck, text: "جلسات محرمانه با ماسک عنوان" },
  { icon: Users, text: "کنترل دسترسی مبتنی بر نقش" },
  { icon: Building2, text: "چندشعبه و چنداتاق" },
  { icon: CheckCircle2, text: "ورود سازمانی LDAP" },
] as const;

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
        <Image
          src="/logo-white.png"
          alt="مهرسا"
          width={24}
          height={24}
          className="h-6 w-6 object-contain"
          priority
        />
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
    { time: "۱۰:۰۰", title: "جلسه هفتگی تیم فروش", room: "اتاق جلسه آریا", status: "قطعی شده", tone: "badge-green" },
    { time: "۱۲:۰۰", title: "مصاحبه استخدامی", room: "اتاق مدیریت", status: "در انتظار تأیید", tone: "badge-amber" },
    { time: "۱۴:۳۰", title: "بازبینی بودجه فصل", room: "اتاق کنفرانس بزرگ", status: "قطعی شده", tone: "badge-green" },
  ];

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[28px] bg-ink/[0.04] blur-0"
      />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_28px_80px_-36px_rgba(13,13,13,0.35)]">
        <div className="flex items-center justify-between border-b border-line bg-paper-soft px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#ef4056]/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-500/80" />
          </div>
          <p className="text-[11px] font-medium text-ink-soft">داشبورد · امروز {faNum("۹")} شهریور</p>
        </div>
        <div className="grid md:grid-cols-[7.5rem_1fr]">
          <aside className="hidden border-l border-line bg-paper-soft/80 p-3 md:block">
            {["داشبورد", "تقویم", "جلسات", "اتاق‌ها", "گزارش‌ها"].map((item, i) => (
              <div
                key={item}
                className={
                  i === 0
                    ? "mb-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-sm"
                    : "mb-1 rounded-md px-2.5 py-1.5 text-[11px] text-ink-soft"
                }
              >
                {item}
              </div>
            ))}
          </aside>
          <div className="p-4">
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { k: "جلسات امروز", v: "۳" },
                { k: "در انتظار تأیید", v: "۱" },
                { k: "اتاق آزاد", v: "۲ / ۴" },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-line bg-paper-soft/70 px-2.5 py-2">
                  <p className="text-[10px] text-ink-faint">{s.k}</p>
                  <p className="mt-0.5 text-[16px] font-bold">{faNum(s.v)}</p>
                </div>
              ))}
            </div>
            <p className="mb-2 text-[11px] font-medium text-ink-soft">جلسات پیش‌رو</p>
            <div className="space-y-2">
              {meetings.map((m) => (
                <div key={m.title} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-[12px] font-medium text-ink">{faNum(m.time)}</span>
                  <div className="min-w-0 flex-1 text-right">
                    <p className="truncate text-[12.5px] font-medium">{m.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{m.room}</p>
                  </div>
                  <span className={`badge ${m.tone} shrink-0`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div dir="rtl" className="relative flex min-h-screen flex-col overflow-x-clip bg-white">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-[13px] text-ink-soft md:flex">
            <a href="#features" className="transition-colors hover:text-ink">قابلیت‌ها</a>
            <a href="#workflow" className="transition-colors hover:text-ink">گردش‌کار</a>
            <a href="#trust" className="transition-colors hover:text-ink">امنیت و دسترسی</a>
          </nav>
          <Link
            href="/login"
            className="flex h-10 items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e] sm:px-5"
          >
            ورود به سامانه
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-paper-soft"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #d9d9e0 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
            <FadeIn>
              <span className="inline-flex items-center rounded-full border border-line bg-white px-3.5 py-1 text-[11.5px] font-medium text-ink-soft">
                سامانه مدیریت جلسات سازمانی
              </span>
              <h1 className="mt-5 text-[28px] font-bold leading-[1.45] sm:text-[36px] lg:text-[40px]">
                زمان سازمان را
                <br />
                از پراکندگی به نظم تبدیل کنید
              </h1>
              <p className="mt-4 max-w-lg text-[14px] leading-8 text-ink-soft">
                مهرسا کل چرخهٔ جلسه را پوشش می‌دهد: درخواست، تخصیص اتاق، تأیید، اعلان،
                برگزاری و گزارش. فارسی، راست‌چین، با تقویم شمسی — مناسب هیئت‌مدیره،
                شعب و تیم‌های عملیاتی.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="flex h-12 items-center rounded-lg bg-ink px-7 text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
                >
                  ورود به سامانه
                </Link>
                <a
                  href="#features"
                  className="flex h-12 items-center rounded-lg border border-line bg-white px-7 text-[14px] text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink"
                >
                  مشاهده قابلیت‌ها
                </a>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[20px] font-bold">{s.value}</dt>
                    <dd className="mt-1 text-[11px] leading-5 text-ink-soft">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </FadeIn>
            <FadeIn delay={0.06} className="lg:ps-4">
              <ProductPreview />
            </FadeIn>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
            <p className="text-[12px] text-ink-faint">ساخته‌شده برای سازمان‌های چندشعبه‌ای</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-soft">
              <span>شعب و اتاق‌ها</span>
              <span className="text-line">|</span>
              <span>تقویم شمسی</span>
              <span className="text-line">|</span>
              <span>ورود LDAP</span>
              <span className="text-line">|</span>
              <span>گزارش CSV</span>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-white px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-xl">
              <p className="text-[12px] font-medium text-ink-faint">قابلیت‌ها</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">
                هر آنچه عملیات جلسه نیاز دارد — در یک سامانه
              </h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                از رزرو اتاق تا گزارش هیئت‌مدیره؛ بدون اکسل موازی، بدون تداخل، بدون ابهام در دسترسی.
              </p>
            </div>
            <StaggerList className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <StaggerItem key={f.title}>
                  <article className="h-full rounded-xl border border-line bg-white p-5 transition-colors hover:border-ink/20 hover:bg-paper-soft/40">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-white">
                      <f.icon className="h-4 w-4" />
                    </span>
                    <h3 className="mt-4 text-[14px] font-bold">{f.title}</h3>
                    <p className="mt-2 text-[12.5px] leading-7 text-ink-soft">{f.desc}</p>
                  </article>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 border-t border-line bg-paper-soft px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-xl">
              <p className="text-[12px] font-medium text-ink-faint">گردش‌کار</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">از درخواست تا گزارش، یک مسیر مشخص</h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                هر نقش دقیقاً می‌داند چه زمانی وارد می‌شود — کارمند درخواست می‌دهد،
                مسئول اتاق تخصیص می‌دهد، مدیر تأیید می‌کند.
              </p>
            </div>
            <ol className="mt-10 grid gap-3 md:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-xl border border-line bg-white p-5">
                  <span className="text-[11px] font-medium text-ink-faint">گام {faNum(s.n)}</span>
                  <h3 className="mt-2 text-[14px] font-bold">{s.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-7 text-ink-soft">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="scroll-mt-20 bg-white px-5 py-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-[12px] font-medium text-ink-faint">امنیت و دسترسی</p>
              <h2 className="mt-2 text-[24px] font-bold leading-10">
                مناسب سازمان‌هایی که محرمانگی و نقش اهمیت دارد
              </h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-soft">
                عنوان جلسات محرمانه فقط برای برگزارکننده، دعوت‌شده و مدیر ارشد دیده می‌شود.
                ورود می‌تواند محلی یا از طریق حساب سازمانی (LDAP) باشد — با ایمیل یا شماره موبایل.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-start gap-3 rounded-xl border border-line p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-paper-soft">
                    <t.icon className="h-4 w-4" />
                  </span>
                  <p className="pt-1.5 text-[13px] font-medium leading-6">{t.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 pb-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl bg-ink px-8 py-10 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-[22px] font-bold">آمادهٔ نظم‌دادن به جلسات سازمان هستید؟</h2>
              <p className="mt-2 max-w-md text-[13px] leading-7 text-white/65">
                با حساب سازمانی وارد شوید. مسیر از داشبورد تا اولین رزرو کمتر از چند دقیقه است.
              </p>
            </div>
            <Link
              href="/login"
              className="flex h-12 shrink-0 items-center rounded-lg bg-white px-7 text-[14px] font-medium text-ink transition-colors hover:bg-paper-soft"
            >
              ورود به سامانه
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white px-5 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <BrandMark />
          <div className="flex flex-wrap gap-5 text-[12px] text-ink-soft">
            <a href="#features" className="hover:text-ink">قابلیت‌ها</a>
            <a href="#workflow" className="hover:text-ink">گردش‌کار</a>
            <a href="#trust" className="hover:text-ink">امنیت</a>
            <Link href="/login" className="hover:text-ink">ورود</Link>
          </div>
          <p className="text-[11px] text-ink-faint">مهرسا — سامانه مدیریت جلسات سازمانی</p>
        </div>
      </footer>
    </div>
  );
}
