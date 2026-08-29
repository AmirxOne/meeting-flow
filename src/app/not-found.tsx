import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink opacity-90">
        <Image src="/logo-white.png" alt="مهرسا" width={32} height={32} className="h-8 w-8 object-contain" />
      </div>
      <p className="text-7xl font-bold tracking-tight text-paper-deep">۴۰۴</p>
      <div className="space-y-1.5">
        <p className="text-[15px] font-medium">این صفحه وجود ندارد</p>
        <p className="mx-auto max-w-sm text-[12px] leading-6 text-ink-soft">
          آدرس اشتباه است یا صفحه جابه‌جا/حذف شده. از میان‌برهای زیر ادامه دهید.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Link
          href="/dashboard"
          className="flex h-10 items-center rounded-lg bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
        >
          بازگشت به داشبورد
        </Link>
        <Link
          href="/calendar"
          className="flex h-10 items-center rounded-lg border border-line px-5 text-[13px] text-ink-soft transition-colors hover:bg-paper-soft"
        >
          تقویم
        </Link>
        <Link
          href="/meetings"
          className="flex h-10 items-center rounded-lg border border-line px-5 text-[13px] text-ink-soft transition-colors hover:bg-paper-soft"
        >
          جلسات
        </Link>
      </div>
    </div>
  );
}
