"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Search, Users, Building2, Trash2 } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { Card, CardHeader, EmptyState, SkeletonBlock } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

export default function AdminPeoplePage() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kind: "EXTERNAL",
    company: "",
    jobTitle: "",
    phone: "",
    email: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-people", q, kindFilter],
    queryFn: () =>
      api<{ people: Person[] }>(
        `/api/people?q=${encodeURIComponent(q)}${kindFilter ? `&kind=${kindFilter}` : ""}`,
      ),
  });

  async function create() {
    setBusy(true);
    try {
      await api("/api/people", { method: "POST", json: form });
      push("فرد ثبت شد", "success");
      setShowForm(false);
      setForm({ name: "", kind: "EXTERNAL", company: "", jobTitle: "", phone: "", email: "" });
      qc.invalidateQueries({ queryKey: ["admin-people"] });
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const people = data?.people ?? [];
  const internalCount = people.filter((p) => p.kind === "INTERNAL").length;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">افراد</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          فرد جدید
        </Button>
      </div>

      {/* add form */}
      {showForm && (
        <Card className="p-4">
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
                { value: "EXTERNAL", label: "خارجی (مهمان / طرف ارتباطی)" },
                { value: "INTERNAL", label: "عضو شرکت" },
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
            <div className="sm:col-span-3">
              <Button onClick={create} loading={busy} disabled={form.name.trim().length < 2}>
                ثبت فرد
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-48 flex-1 items-center gap-2 rounded-md border border-line bg-white px-3 sm:max-w-64">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نام، شرکت، سمت…"
            className="w-full bg-transparent text-[12px] outline-none"
          />
        </div>
        <div className="w-44">
          <Select
            value={kindFilter}
            onChange={setKindFilter}
            placeholder="همه"
            options={[
              { value: "INTERNAL", label: "اعضای شرکت" },
              { value: "EXTERNAL", label: "افراد خارجی" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonBlock className="h-72" />
      ) : people.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-10 w-10" />} title="فردی یافت نشد" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`دایرکتوری افراد (${faNum(people.length)} نفر)`}
            subtitle={`${faNum(internalCount)} عضو شرکت · ${faNum(people.length - internalCount)} خارجی`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px]">
              <thead className="border-b border-line bg-paper-soft/50 text-[11px] text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-medium">نام</th>
                  <th className="px-4 py-2.5 font-medium">نوع</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">شرکت</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">سمت</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">تلفن</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">ایمیل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold",
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
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">
                      {p.company ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {p.company}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{p.jobTitle ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-ink-soft lg:table-cell" dir="ltr">
                      {p.phone ? faStr(p.phone) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-faint lg:table-cell" dir="ltr">
                      {p.email ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
