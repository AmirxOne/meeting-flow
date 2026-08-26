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

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
