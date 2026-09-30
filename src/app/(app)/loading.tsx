/** Route-level suspense fallback — spinner between page transitions. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="btn-dots-spinner scale-[2]" aria-hidden="true" dir="ltr">
          <span />
          <span />
          <span />
        </span>
        <p className="text-[12px] text-ink-faint">در حال بارگذاری…</p>
      </div>
    </div>
  );
}
