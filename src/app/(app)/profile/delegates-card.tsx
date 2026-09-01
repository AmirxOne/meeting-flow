"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2 } from "@/components/ui/icon";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-store";
import { faNum } from "@/lib";

type DelegateUser = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
};

type DelegateRow = {
  id: string;
  createdAt: string;
  user: DelegateUser;
};

type Colleague = {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  department?: string | null;
};

function userHint(u: { jobTitle?: string | null; department?: string | null }) {
  return [u.jobTitle, u.department].filter(Boolean).join(" · ");
}

export function DelegatesCard() {
  const { me, can } = useAuth();
  const { push } = useToast();
  const qc = useQueryClient();
  const canAppoint = can("meeting:create");
  const [addOpen, setAddOpen] = useState(false);
  const [removeRow, setRemoveRow] = useState<DelegateRow | null>(null);
  const [pickedId, setPickedId] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["delegates"],
    queryFn: () =>
      api<{ delegates: DelegateRow[]; principals: DelegateRow[] }>("/api/delegates"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-lite"],
    queryFn: () => api<{ users: Colleague[] }>("/api/users"),
    enabled: addOpen && canAppoint,
  });

  const appointed = data?.delegates ?? [];
  const principals = data?.principals ?? [];
  const taken = new Set(appointed.map((d) => d.user.id));

  const candidates = useMemo(() => {
    const needle = q.trim();
    return (usersData?.users ?? [])
      .filter((u) => u.id !== me?.id && !taken.has(u.id))
      .filter((u) => {
        if (!needle) return true;
        const hay = `${u.fullName} ${u.jobTitle ?? ""} ${u.department ?? ""}`;
        return hay.includes(needle);
      });
  }, [usersData, me?.id, taken, q]);

  async function add() {
    if (!pickedId) return;
    setBusy(true);
    try {
      await api("/api/delegates", { method: "POST", json: { userId: pickedId } });
      await qc.invalidateQueries({ queryKey: ["delegates"] });
      push("نماینده افزوده شد", "success");
      setAddOpen(false);
      setPickedId("");
      setQ("");
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removeRow) return;
    setBusy(true);
    try {
      await api(`/api/delegates/${removeRow.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["delegates"] });
      push("نماینده حذف شد", "success");
      setRemoveRow(null);
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card data-tour="meeting-delegates" data-testid="delegates-card">
        <CardHeader
          title="نماینده‌های رزرو"
          subtitle="افرادی که به نام شما جلسه می‌سازند و تقویم مشغولیتان را در یافتن زمان می‌بینند"
          action={
            canAppoint ? (
              <Button
                size="sm"
                variant="secondary"
                data-testid="delegate-add-btn"
                onClick={() => {
                  setPickedId("");
                  setQ("");
                  setAddOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                افزودن نماینده
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-4">
          {isLoading || !data ? (
            <SkeletonBlock className="h-24 w-full" />
          ) : (
            <>
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink">لیست نماینده‌ها</p>
                {appointed.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line px-3.5 py-4 text-[12px] leading-6 text-ink-soft">
                    {canAppoint
                      ? "نماینده‌ای ندارید. یک همکار را اضافه کنید تا بتواند به نام شما جلسه رزرو کند."
                      : "شما دسترسی ایجاد جلسه ندارید."}
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-md border border-line" data-testid="delegate-list">
                    {appointed.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        data-testid={`delegate-row-${row.user.id}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{row.user.fullName}</p>
                          {userHint(row.user) ? (
                            <p className="truncate text-[11px] text-ink-soft">{userHint(row.user)}</p>
                          ) : null}
                        </div>
                        {canAppoint && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`حذف ${row.user.fullName}`}
                            onClick={() => setRemoveRow(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] leading-5 text-ink-soft">
                  {faNum(appointed.length)} نماینده. جلسات محرمانهٔ شما برای نماینده فقط به‌صورت زمان مشغول دیده می‌شود، نه عنوان.
                </p>
              </div>

              {principals.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink">شما نمایندهٔ این افراد هستید</p>
                  <ul className="divide-y divide-line rounded-md border border-line" data-testid="principal-list">
                    {principals.map((row) => (
                      <li key={row.id} className="px-3.5 py-2.5">
                        <p className="text-[13px] font-medium">{row.user.fullName}</p>
                        {userHint(row.user) ? (
                          <p className="text-[11px] text-ink-soft">{userHint(row.user)}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="افزودن نماینده"
        subtitle="این فرد می‌تواند در ویزارد برگزارکننده را شما انتخاب کند"
        footer={
          <div className="flex gap-2">
            <Button onClick={add} loading={busy} disabled={!pickedId}>
              افزودن
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نام یا سمت…"
            data-testid="delegate-search"
            className="h-11 w-full rounded-md border border-[#d9d9e0] bg-white px-3.5 text-right text-[13px] outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/15"
          />
          <ul className="max-h-64 overflow-y-auto rounded-md border border-line">
            {candidates.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[12px] text-ink-soft">کاربری برای افزودن نیست</li>
            ) : (
              candidates.map((u) => {
                const selected = pickedId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      data-testid={`delegate-pick-${u.id}`}
                      onClick={() => setPickedId(u.id)}
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-right text-[13px] ${
                        selected ? "bg-paper-soft" : "hover:bg-paper-soft/60"
                      }`}
                    >
                      <span>
                        <span className="block font-medium">{u.fullName}</span>
                        {userHint(u) ? (
                          <span className="block text-[11px] text-ink-soft">{userHint(u)}</span>
                        ) : null}
                      </span>
                      {selected && <span className="text-[11px] text-ink-soft">انتخاب‌شده</span>}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </Modal>

      <Modal
        open={!!removeRow}
        onClose={() => setRemoveRow(null)}
        title="حذف نماینده"
        subtitle={removeRow ? `${removeRow.user.fullName} دیگر به نام شما جلسه نمی‌سازد` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="danger" onClick={remove} loading={busy}>
              حذف
            </Button>
            <Button variant="ghost" onClick={() => setRemoveRow(null)}>
              انصراف
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-soft">
          جلساتی که قبلاً به نام شما ساخته شده‌اند باقی می‌مانند.
        </p>
      </Modal>
    </>
  );
}
