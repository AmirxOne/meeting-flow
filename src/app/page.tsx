import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function LandingPage() {
  // logged-in users go straight to work
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const features = [
    { title: "رزرو هوشمند اتاق", desc: "پیشنهاد خودکار زمان آزاد همه‌ی دعوت‌شدگان و اتاق مناسب" },
    { title: "بدون تداخل، همیشه", desc: "قفل سه‌لایه‌ی دیتابیسی — دو جلسه در یک اتاق ممکن نیست" },
    { title: "تقویم شمسی کامل", desc: "نمای ماه، هفته و روز با دقیق‌ترین تقویم رسمی ایران" },
    { title: "گردش کار تأیید", desc: "جلسات مهمان‌دار یا VIP با تأیید اپراتور قطعی می‌شوند" },
    { title: "اعلان و یادآور", desc: "دعوت، تغییر زمان/اتاق و یادآور ۱۵ دقیقه قبل" },
    { title: "گزارش مدیریت", desc: "ساعت جلسات، استفاده‌ی اتاق‌ها و نرخ لغو — با خروجی CSV" },
  ];

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-white">
      {/* header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink">
            <Image src="/logo-white.png" alt="مهرسا" width={28} height={28} className="h-7 w-7 object-contain" priority />
          </div>
          <p className="text-[15px] font-bold">مهرسا</p>
        </div>
        <Link
          href="/login"
          className="flex h-10 items-center rounded-lg bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
        >
          ورود به سامانه
        </Link>
      </header>

      {/* hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-16 pt-14 text-center">
        <span className="rounded-full border border-line bg-paper-soft px-4 py-1.5 text-[12px] text-ink-soft">
          سامانه مدیریت جلسات سازمانی
        </span>
        <h1 className="mt-6 max-w-2xl text-3xl font-bold leading-[1.4] sm:text-4xl">
          جلسه‌های سازمان را از شلوغی
          <br />
          به جریان تبدیل کنید
        </h1>
        <p className="mt-5 max-w-xl text-[14px] leading-7 text-ink-soft">
          از درخواست جلسه تا تأیید، اعلان، برگزاری و گزارش — همه‌چیز در یک سامانه‌ی
          فارسی با تقویم شمسی و تجربه‌ای که کاربرانتان از روز اول می‌فهمند.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="flex h-12 items-center rounded-lg bg-ink px-7 text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
          >
            شروع کنید
          </Link>
          <Link
            href="/login"
            className="flex h-12 items-center rounded-lg border border-line px-7 text-[14px] text-ink-soft transition-colors hover:bg-paper-soft"
          >
            مشاهده‌ی دمو
          </Link>
        </div>

        {/* features */}
        <div className="mt-16 grid w-full gap-3 text-right sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div key={f.title} className="rounded-lg border border-line bg-white p-5 transition-colors hover:border-ink-faint">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper-soft text-[13px] font-bold text-ink">
                {"۱۲۳۴۵۶".slice(i, i + 1)}
              </div>
              <p className="mt-3 text-[14px] font-bold">{f.title}</p>
              <p className="mt-1.5 text-[12px] leading-6 text-ink-soft">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* footer */}
      <footer className="border-t border-line px-5 py-5 text-center">
        <p className="text-[11px] text-ink-faint">مهرسا — سامانه مدیریت جلسات سازمانی</p>
      </footer>
    </div>
  );
}
