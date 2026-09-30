/** Route-level suspense fallback — page-shaped skeleton between transitions. */
export default function Loading() {
  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      {/* هدر صفحه */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-6 w-44" />
          <div className="skeleton h-3.5 w-72" />
        </div>
        <div className="skeleton h-10 w-32 rounded-md" />
      </div>
      {/* کارت اصلی */}
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-8 w-24 rounded-full" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-5 py-4 last:border-0">
            <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-2/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
