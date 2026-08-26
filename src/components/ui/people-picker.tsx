"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X, Building2, Briefcase } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { cn, faStr } from "@/lib";
import { useToast } from "@/components/ui/toast";

export interface PickedPerson {
  /** "user:<id>" for company members (resolvable to MeetingParticipant),
   *  "dir:<id>" for known external contacts,
   *  "new:<name>" for ad-hoc typed people */
  ref: string;
  name: string;
  company?: string;
  jobTitle?: string;
  kind: "INTERNAL" | "EXTERNAL";
  email?: string;
  phone?: string;
}

interface DirectoryPerson {
  id: string;
  name: string;
  kind: "INTERNAL" | "EXTERNAL";
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
}

function refOf(p: DirectoryPerson): string {
  return `dir:${p.id}`;
}

/**
 * Universal people picker: search the company directory (internal members +
 * known external contacts), or type a brand-new name for one-off guests.
 * Persian, RTL, custom (no native controls).
 */
export function PeoplePicker({
  value,
  onChange,
  allowManual = true,
  placeholder = "افزودن فرد — بنویسید یا جستجو کنید…",
  max,
}: {
  value: PickedPerson[];
  onChange: (people: PickedPerson[]) => void;
  allowManual?: boolean;
  placeholder?: string;
  max?: number;
}) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ name: "", company: "", jobTitle: "", phone: "", email: "" });
  const rootRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["people", query],
    queryFn: () =>
      api<{ people: DirectoryPerson[] }>(
        `/api/people?q=${encodeURIComponent(query)}`,
      ),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setManualMode(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pickedRefs = new Set(value.map((v) => v.ref));

  const results = (data?.people ?? []).filter((p) => {
    if (pickedRefs.has(refOf(p))) return false;
    if (pickedRefs.has(`new:${p.name}`)) return false;
    return true;
  });

  const exactExists =
    results.some((r) => r.name === query.trim()) ||
    value.some((v) => v.name === query.trim());

  function pick(p: DirectoryPerson) {
    if (max && value.length >= max) return;
    onChange([
      ...value,
      {
        ref: refOf(p),
        name: p.name,
        company: p.company ?? undefined,
        jobTitle: p.jobTitle ?? undefined,
        kind: p.kind,
        email: p.email ?? undefined,
        phone: p.phone ?? undefined,
      },
    ]);
    setQuery("");
  }

  async function saveManualToDirectory() {
    if (manual.name.trim().length < 2) {
      push("نام را کامل بنویسید", "error");
      return;
    }
    try {
      const res = await api<{ person: DirectoryPerson }>("/api/people", {
        method: "POST",
        json: {
          name: manual.name.trim(),
          kind: "EXTERNAL",
          company: manual.company.trim() || undefined,
          jobTitle: manual.jobTitle.trim() || undefined,
          phone: manual.phone.trim() || undefined,
          email: manual.email.trim() || undefined,
        },
      });
      pick(res.person);
      setManual({ name: "", company: "", jobTitle: "", phone: "", email: "" });
      setManualMode(false);
      push("به دایرکتوری افراد اضافه شد", "success");
      qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* selected chips */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span
              key={p.ref}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]",
                p.kind === "INTERNAL"
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-paper-soft text-ink",
              )}
            >
              {p.kind === "EXTERNAL" && "خارجی · "}
              {p.name}
              {p.company ? ` (${p.company})` : ""}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.ref !== p.ref))}
                className="opacity-70 hover:opacity-100"
                aria-label={`حذف ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* search trigger */}
      <div className="flex h-11 items-center gap-2 rounded-lg border border-[#d9d9e0] bg-white px-3.5 focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(13,13,13,0.08)]">
        <UserPlus className="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setManualMode(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && allowManual && query.trim().length >= 2 && !exactExists) {
              e.preventDefault();
              // quick add without company info
              if (!(max && value.length >= (max ?? 99))) {
                onChange([
                  ...value,
                  { ref: `new:${query.trim()}`, name: query.trim(), kind: "EXTERNAL" },
                ]);
                setQuery("");
              }
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
        />
        {query.trim().length >= 2 && allowManual && !exactExists && (
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="shrink-0 rounded-md bg-paper-soft px-2 py-1 text-[11px] text-ink-soft hover:bg-paper-deep"
          >
            + ثبت «{query.trim()}»
          </button>
        )}
      </div>

      {/* dropdown */}
      {open && (
        <div className="absolute right-0 left-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-line bg-white p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          {/* manual form */}
          {manualMode ? (
            <div className="space-y-2 p-2">
              <p className="text-[12px] font-bold">افزودن فرد جدید به دایرکتوری</p>
              <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="نام و نام خانوادگی *" className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
              <div className="grid grid-cols-2 gap-2">
                <input value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} placeholder="شرکت / سازمان" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input value={manual.jobTitle} onChange={(e) => setManual({ ...manual, jobTitle: e.target.value })} placeholder="عنوان شغلی" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input dir="ltr" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} placeholder="تلفن" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input dir="ltr" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} placeholder="ایمیل" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveManualToDirectory} className="h-9 flex-1 rounded-md bg-ink text-[12px] font-medium text-white hover:bg-[#2a2a2e]">
                  ذخیره و افزودن
                </button>
                <button type="button" onClick={() => setManualMode(false)} className="h-9 rounded-md border border-line px-3 text-[12px] text-ink-soft">
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            <>
              {!data && <p className="p-3 text-center text-[12px] text-ink-faint">در حال جستجو…</p>}
              {data && results.length === 0 && (
                <p className="p-3 text-center text-[12px] text-ink-faint">
                  {query ? "کسی با این مشخصات یافت نشد — خودتان ثبت کنید" : "دایرکتوری خالی است"}
                </p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-right transition-colors hover:bg-paper-soft"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      p.kind === "INTERNAL" ? "bg-ink text-white" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{p.name}</span>
                      <span className={cn("badge", p.kind === "INTERNAL" ? "badge-gray" : "badge-amber")}>
                        {p.kind === "INTERNAL" ? "عضو شرکت" : "خارجی"}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-faint">
                      {p.jobTitle && (
                        <span className="flex items-center gap-0.5">
                          <Briefcase className="h-3 w-3" />
                          {p.jobTitle}
                        </span>
                      )}
                      {p.company && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-3 w-3" />
                          {p.company}
                        </span>
                      )}
                      {p.phone && <span dir="ltr">{faStr(p.phone)}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
