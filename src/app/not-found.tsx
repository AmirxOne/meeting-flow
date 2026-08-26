import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-paper-deep">۴۰۴</p>
      <p className="text-[15px] font-medium">صفحه پیدا نشد</p>
      <p className="max-w-xs text-[12px] text-ink-soft">
        آدرسی که دنبال آن هستید وجود ندارد یا جابه‌جا شده است.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-10 items-center rounded-xl bg-ink px-5 text-[13px] font-medium text-white hover:bg-[#2a2a2e]"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  );
}
