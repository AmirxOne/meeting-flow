import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-7xl font-bold tracking-tight text-paper-deep">۴۰۴</p>
      <p className="text-[15px] font-medium">صفحه پیدا نشد</p>
      <p className="max-w-sm text-[12px] leading-5 text-ink-soft">
        آدرسی که دنبال آن هستید وجود ندارد، جابه‌جا شده یا جلسه/اتاق مورد نظر حذف
        شده است.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
        >
          بازگشت به داشبورد
        </Link>
        <Link
          href="/meetings"
          className="inline-flex h-10 items-center rounded-md border border-line px-5 text-[13px] text-ink-soft transition-colors hover:bg-paper-soft"
        >
          جلسات
        </Link>
        <Link
          href="/calendar"
          className="inline-flex h-10 items-center rounded-md border border-line px-5 text-[13px] text-ink-soft transition-colors hover:bg-paper-soft"
        >
          تقویم
        </Link>
      </div>
    </div>
  );
}
