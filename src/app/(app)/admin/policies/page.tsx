"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { faNum } from "@/lib";

interface Policy {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}

const POLICY_FA: Record<string, { label: string; type: "bool" | "number" | "list"; unit?: string }> = {
  requireApprovalExternalGuest: { label: "جلسه با مهمان خارجی نیاز به تأیید دارد", type: "bool" },
  requireApprovalVipRoom: { label: "اتاق VIP نیاز به تأیید دارد", type: "bool" },
  requireApprovalLongerThanMin: { label: "جلسه طولانی‌تر از این مدت نیاز به تأیید دارد", type: "number", unit: "دقیقه" },
  autoApproveInternal: { label: "جلسه داخلی خودکار تأیید شود", type: "bool" },
  minDurationMin: { label: "حداقل مدت جلسه", type: "number", unit: "دقیقه" },
  maxDurationMin: { label: "حداکثر مدت جلسه", type: "number", unit: "دقیقه" },
  defaultReminderOffsets: { label: "یادآورها (دقیقه قبل از جلسه)", type: "list" },
};

export default function AdminPoliciesPage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api<{ policies: Policy[] }>("/api/admin/policies"),
  });

  async function update(key: string, value: unknown) {
    try {
      await api("/api/admin/policies", { method: "PATCH", json: { key, value } });
      push("سیاست ذخیره شد", "success");
      qc.invalidateQueries({ queryKey: ["policies"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 lg:p-6">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-96" />
      </div>
    );
  }

  const policies = data?.policies ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <h1 className="text-lg font-bold">سیاست‌های جلسه</h1>

      <Card>
        <CardHeader title="قواعد تأیید و محدودیت‌ها" subtitle="تغییرات بلافاصله اعمال می‌شود" />
        <CardBody className="space-y-4">
          {policies.map((p) => {
            const meta = POLICY_FA[p.key] ?? { label: p.key, type: "bool" as const };
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{meta.label}</p>
                  {p.description && <p className="mt-0.5 text-[11px] text-ink-faint">{p.description}</p>}
                </div>
                {meta.type === "bool" && (
                  <button
                    onClick={() => update(p.key, !p.value)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${p.value ? "bg-ink" : "bg-paper-deep"}`}
                    aria-label="تغییر"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.value ? "right-0.5" : "right-[22px]"}`}
                    />
                  </button>
                )}
                {meta.type === "number" && (
                  <input
                    type="number"
                    dir="ltr"
                    defaultValue={Number(p.value)}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(p.value)) update(p.key, v);
                    }}
                    className="h-9 w-24 shrink-0 rounded-xl border border-line px-3 text-center text-[12px] outline-none focus:border-ink"
                  />
                )}
                {meta.type === "list" && (
                  <span className="shrink-0 text-[12px] text-ink-soft">
                    {(p.value as number[]).map((v) => `${faNum(v)} دقیقه`).join("، ")}
                  </span>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
