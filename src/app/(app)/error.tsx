"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Route-level error boundary (500s inside the app shell). */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // surface for logging/telemetry — never crash the boundary itself
    console.error("[route-error]", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-paper-deep">۵۰۰</p>
      <p className="text-[15px] font-medium">خطای غیرمنتظره رخ داد</p>
      <p className="max-w-sm text-[12px] leading-5 text-ink-soft">
        مشکلی در نمایش این بخش پیش آمد. معمولاً دوباره تلاش کردن مشکل را حل می‌کند.
        اگر ادامه داشت، موضوع را به مدیر سیستم اطلاع دهید.
      </p>
      {error?.digest && (
        <code className="rounded bg-paper-soft px-2 py-1 text-[10px] text-ink-faint" dir="ltr">
          {error.digest}
        </code>
      )}
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center rounded-md bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2a2e]"
        >
          تلاش دوباره
        </button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md border border-line px-5 text-[13px] text-ink-soft transition-colors hover:bg-paper-soft"
        >
          داشبورد
        </Link>
      </div>
    </div>
  );
}
