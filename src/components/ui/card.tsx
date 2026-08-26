import { cn } from "@/lib";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-md border border-line bg-white", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
      <div>
        <h3 className="text-[14px] font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] text-ink-soft">{label}</p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-bold",
              tone === "success" && "text-emerald-600",
              tone === "danger" && "text-red-600",
              tone === "warn" && "text-amber-600",
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>}
        </div>
        {icon && <div className="text-ink-faint">{icon}</div>}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="text-[14px] font-medium">{title}</p>
      {description && <p className="max-w-sm text-[12px] text-ink-soft">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/** Row skeleton: avatar circle + two text lines — mirrors list rows everywhere. */
export function SkeletonRow({ withBadge = true }: { withBadge?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3.5 w-1/2" />
        <div className="skeleton h-3 w-1/3" />
      </div>
      {withBadge && <div className="skeleton h-5 w-16 rounded-full" />}
    </div>
  );
}

/** Table skeleton: header + n rows of cells matching column count. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="flex gap-4 border-b border-line bg-paper-soft/50 px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={cn("skeleton h-3.5", c === 0 ? "w-28" : "flex-1")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
