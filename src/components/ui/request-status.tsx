export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "در انتظار هماهنگی", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    SCHEDULED: { label: "زمان‌بندی شد ✓", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    REJECTED: { label: "رد شد", cls: "bg-red-50 text-red-700 border-red-200" },
    CANCELLED: { label: "لغو شد", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export const URGENCY_FA: Record<string, string> = {
  URGENT: "فوری — در اسرع وقت",
  NORMAL: "معمولی",
  FLEXIBLE: "منعطف — هر زمان مناسب",
};

export type MyRequest = {
  id: string;
  title: string;
  urgency: string;
  durationMin: number;
  status: string;
  createdAt: string;
};
