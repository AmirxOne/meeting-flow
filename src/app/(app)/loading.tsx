/** Route-level suspense fallback — spinner between page transitions. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
        <p className="text-[12px] text-ink-faint">در حال بارگذاری…</p>
      </div>
    </div>
  );
}
