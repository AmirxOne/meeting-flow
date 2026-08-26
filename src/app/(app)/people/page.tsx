"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, Search, Pencil, Trash2, UserPlus, Phone, Mail, Building2, Briefcase } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock, SkeletonTable } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/ui/filter-bar";
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

export default function PeoplePage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "EXTERNAL", company: "", jobTitle: "", phone: "", email: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["people-page", q, kindFilter],
    queryFn: () =>
      api<{ people: Person[] }>(`/api/people?q=${encodeURIComponent(q)}${kindFilter ? `&kind=${kindFilter}` : ""}`),
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
  const internalCount = people.filter((p) => p.kind === "INTERNAL").length;

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

      {/* add/edit form */}
      {showForm && (
        <Card className="p-4">
          <p className="mb-3 text-[13px] font-bold">{editing ? `ویرایش ${editing.name}` : "افزودن فرد"}</p>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="flex gap-2 sm:col-span-3">
              <Button onClick={save} loading={busy} disabled={form.name.trim().length < 2}>
                {editing ? "ذخیره تغییرات" : "افزودن"}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                انصراف
              </Button>
            </div>
          </div>
        </Card>
      )}

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
        onChange={(v) => setKindFilter(v.kind)}
      >
        <div className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نام، شرکت، سمت…"
            className="w-full bg-transparent text-[12px] outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-ink-faint hover:text-ink" aria-label="پاک کردن">✕</button>
          )}
        </div>
      </FilterBar>

      {isLoading ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="mt-1 h-3 w-32" />
          </div>
          <SkeletonTable rows={8} cols={5} />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                      p.kind === "INTERNAL" ? "bg-ink text-white" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{p.name}</p>
                    <span className={cn("badge mt-1", p.kind === "INTERNAL" ? "badge-gray" : "badge-amber")}>
                      {p.kind === "INTERNAL" ? "عضو شرکت" : "خارجی"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
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
              </div>
              <div className="mt-3 space-y-1.5 text-[11px] text-ink-soft">
                {p.jobTitle && (
                  <p className="flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3" />
                    {p.jobTitle}
                  </p>
                )}
                {p.company && (
                  <p className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    {p.company}
                  </p>
                )}
                {p.phone && (
                  <p className="flex items-center gap-1.5" dir="ltr">
                    <Phone className="h-3 w-3" />
                    <span dir="ltr">{faStr(p.phone)}</span>
                  </p>
                )}
                {p.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span dir="ltr" className="truncate">{p.email}</span>
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && people.length > 0 && (
        <p className="text-center text-[11px] text-ink-faint">
          {faNum(internalCount)} عضو شرکت · {faNum(people.length - internalCount)} خارجی
        </p>
      )}
    </div>
  );
}
