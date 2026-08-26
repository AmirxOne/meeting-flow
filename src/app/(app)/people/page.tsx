"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, Search, Pencil, Trash2, UserPlus, ChevronRight, ChevronLeft } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonTable } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/ui/filter-bar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn, faNum, faStr } from "@/lib";

interface Person {
  id: string;
  name: string;
  kind: "INTERNAL" | "EXTERNAL";
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
}

const PAGE_SIZE = 20;

export default function PeoplePage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "EXTERNAL", company: "", jobTitle: "", phone: "", email: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["people-page", q, kindFilter, page],
    queryFn: () =>
      api<{ people: Person[]; total: number }>(
        `/api/people?q=${encodeURIComponent(q)}${kindFilter ? `&kind=${kindFilter}` : ""}&take=${PAGE_SIZE}&skip=${(page - 1) * PAGE_SIZE}`,
      ),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", kind: "EXTERNAL", company: "", jobTitle: "", phone: "", email: "" });
    setShowForm(true);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setForm({
      name: p.name,
      kind: p.kind,
      company: p.company ?? "",
      jobTitle: p.jobTitle ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/people/${editing.id}`, { method: "PATCH", json: form });
        push("اطلاعات فرد ویرایش شد", "success");
      } else {
        await api("/api/people", { method: "POST", json: form });
        push("فرد به دایرکتوری اضافه شد", "success");
      }
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["people-page"] });
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["admin-people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Person) {
    if (!confirm(`حذف «${p.name}» از دایرکتوری؟ (سابقه جلسات حفظ می‌شود)`)) return;
    try {
      await api(`/api/people/${p.id}`, { method: "DELETE" });
      push("حذف شد", "success");
      qc.invalidateQueries({ queryKey: ["people-page"] });
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  const people = data?.people ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const internalCount = people.filter((p) => p.kind === "INTERNAL").length;

  // reset page when filters change
  function setFilterKind(v: string) {
    setKindFilter(v);
    setPage(1);
  }
  function setSearch(v: string) {
    setQ(v);
    setPage(1);
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">افراد</h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            دایرکتوری اعضای شرکت و ارتباط‌های خارجی — هنگام ساخت جلسه از همین لیست انتخاب می‌شود
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          فرد جدید
        </Button>
      </div>

      {/* add/edit modal (bottom sheet on mobile) */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `ویرایش ${editing.name}` : "افزودن فرد"}
        subtitle="اعضای شرکت و ارتباط‌های خارجی — هنگام ساخت جلسه از همین لیست انتخاب می‌شوند"
        footer={
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2}>
              {editing ? "ذخیره تغییرات" : "افزودن"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              انصراف
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="نام و نام خانوادگی *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={[
              { value: "INTERNAL", label: "عضو شرکت" },
              { value: "EXTERNAL", label: "خارجی (مهمان / ارتباط)" },
            ]}
          />
          <input
            placeholder="شرکت / سازمان"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            placeholder="عنوان شغلی"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            dir="ltr"
            placeholder="تلفن"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
          <input
            dir="ltr"
            placeholder="ایمیل"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink"
          />
        </div>
      </Modal>

      {/* filters */}
      <FilterBar
        groups={[
          {
            key: "kind",
            label: "نوع",
            options: [
              { value: "", label: "همه" },
              { value: "INTERNAL", label: "اعضای شرکت" },
              { value: "EXTERNAL", label: "افراد خارجی" },
            ],
          },
        ]}
        value={{ kind: kindFilter }}
        onChange={(v) => setFilterKind(v.kind)}
      >
        <div className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام، شرکت، سمت…"
            className="w-full bg-transparent text-[12px] outline-none"
          />
          {q && (
            <button onClick={() => setSearch("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">✕</button>
          )}
        </div>
      </FilterBar>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="skeleton h-4 w-40" />
          </div>
          <SkeletonTable rows={10} cols={6} />
        </Card>
      ) : people.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound className="h-10 w-10" />}
            title="فردی یافت نشد"
            description="افراد شرکت و مهمان‌های خارجی را اینجا ثبت کنید تا هنگام ساخت جلسه سریع انتخاب شوند"
            action={<Button size="sm" onClick={openCreate}>افزودن اولین فرد</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`افراد (${faNum(total)} نفر)`}
            subtitle={`صفحه ${faNum(page)} از ${faNum(totalPages)} — در این صفحه: ${faNum(internalCount)} عضو شرکت · ${faNum(people.length - internalCount)} خارجی`}
          />
          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full text-right text-[12px]">
              <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <tr>
                  <th className="w-10 px-2 py-2.5 text-center font-medium">ردیف</th>
                  <th className="px-4 py-2.5 font-medium">نام</th>
                  <th className="px-4 py-2.5 font-medium">نوع</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">شرکت</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">سمت</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">تلفن</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">ایمیل</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p, i) => (
                  <tr key={p.id} className="transition-colors hover:bg-paper-soft/50">
                    <td className="px-2 py-3 text-center text-[11px] text-ink-faint">
                      {faNum((page - 1) * PAGE_SIZE + i + 1)}
                    </td>
                      <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            p.kind === "INTERNAL" ? "bg-ink text-white" : "bg-amber-50 text-amber-700",
                          )}
                        >
                          {p.name.slice(0, 1)}
                        </span>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", p.kind === "INTERNAL" ? "badge-gray" : "badge-amber")}>
                        {p.kind === "INTERNAL" ? "عضو شرکت" : "خارجی"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{p.company ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{p.jobTitle ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-ink-soft lg:table-cell" dir="ltr">
                      {p.phone ? faStr(p.phone) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-faint lg:table-cell" dir="ltr">
                      <span className="block max-w-40 truncate">{p.email ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink"
                          title="ویرایش"
                          aria-label="ویرایش"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="rounded-md p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600"
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-[11px] text-ink-faint">
                نمایش {faNum((page - 1) * PAGE_SIZE + 1)} تا {faNum(Math.min(page * PAGE_SIZE, total))} از {faNum(total)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:bg-paper-soft disabled:opacity-40"
                  aria-label="صفحه قبل"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-[11px] text-ink-faint">…</span>}
                      <button
                        onClick={() => setPage(p)}
                        className={cn(
                          "h-8 min-w-8 rounded-md border px-2 text-[12px] transition-colors",
                          p === page
                            ? "border-ink bg-ink font-bold text-white"
                            : "border-line text-ink-soft hover:bg-paper-soft",
                        )}
                      >
                        {faNum(p)}
                      </button>
                    </span>
                  ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:bg-paper-soft disabled:opacity-40"
                  aria-label="صفحه بعد"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
