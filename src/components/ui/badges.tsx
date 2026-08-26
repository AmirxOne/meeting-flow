import { cn, STATUS_FA, TYPE_FA } from "@/lib";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "badge-gray",
  PENDING_APPROVAL: "badge-amber",
  APPROVED: "badge-blue",
  CONFIRMED: "badge-green",
  REJECTED: "badge-red",
  CANCELLED: "badge-gray",
  RESCHEDULED: "badge-blue",
  IN_PROGRESS: "badge-black",
  COMPLETED: "badge-gray",
  NO_SHOW: "badge-red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("badge", STATUS_STYLE[status] ?? "badge-gray")}>
      {STATUS_FA[status] ?? status}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge-gray">{TYPE_FA[type] ?? type}</span>;
}
