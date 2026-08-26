"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Briefcase, Search, ChevronDown } from "lucide-react";
import { api, type ApiError } from "@/lib/api";
import { cn, faNum, faStr } from "@/lib";
import { useToast } from "@/components/ui/toast";

export interface PickedPerson {
  /** "dir:<id>" for directory entries, "new:<name>" for ad-hoc typed people */
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

const PAGE = 20;

/**
 * Multi-select searchable people picker — scales to 1000+ people.
 * Server-side search (debounced), keyboard nav, chips inside the box,
 * manual entry fallback for people not in the directory.
 */
export function PeoplePicker({
  value,
  onChange,
  allowManual = true,
  placeholder = "جستجو و انتخاب افراد…",
  max,
  disabled,
}: {
  value: PickedPerson[];
  onChange: (people: PickedPerson[]) => void;
  allowManual?: boolean;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ name: "", company: "", jobTitle: "", phone: "", email: "" });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // debounce search (300ms) — server-side query for scale
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["people", debounced],
    queryFn: () =>
      api<{ people: DirectoryPerson[]; total: number }>(
        `/api/people?q=${encodeURIComponent(debounced)}&take=200`,
      ),
    enabled: open,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setManualMode(false);
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // reset highlight when results change
  useEffect(() => {
    setActive(0);
    setShowMore(false);
  }, [debounced]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelectorAll("[data-idx]")[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pickedRefs = useMemo(() => new Set(value.map((v) => v.ref)), [value]);

  const results = useMemo(
    () =>
      (data?.people ?? []).filter((p) => {
        if (pickedRefs.has(`dir:${p.id}`)) return false;
        if (pickedRefs.has(`new:${p.name}`)) return false;
        return true;
      }),
    [data, pickedRefs],
  );

  const visible = showMore ? results : results.slice(0, PAGE);
  const totalPeople = data?.total ?? 0;

  const exactExists =
    results.some((r) => r.name === query.trim()) ||
    value.some((v) => v.name === query.trim());

  function pick(p: DirectoryPerson) {
    if (max && value.length >= max) {
      push(`حداکثر ${faNum(max)} نفر`, "error");
      return;
    }
    onChange([
      ...value,
      {
        ref: `dir:${p.id}`,
        name: p.name,
        company: p.company ?? undefined,
        jobTitle: p.jobTitle ?? undefined,
        kind: p.kind,
        email: p.email ?? undefined,
        phone: p.phone ?? undefined,
      },
    ]);
    setQuery("");
    inputRef.current?.focus();
  }

  function quickAddTyped() {
    const name = query.trim();
    if (name.length < 2) return;
    if (max && value.length >= max) return;
    if (exactExists) return;
    onChange([...value, { ref: `new:${name}`, name, kind: "EXTERNAL" }]);
    setQuery("");
    inputRef.current?.focus();
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

  function onKeyDown(e: React.KeyboardEvent) {
    if (manualMode) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) { setOpen(true); break; }
        setActive((a) => Math.min(visible.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((a) => Math.max(0, a - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (open && visible[active]) pick(visible[active]);
        else if (open && allowManual && query.trim().length >= 2 && !exactExists) quickAddTyped();
        break;
      case "Backspace":
        if (query === "" && value.length > 0) {
          e.preventDefault();
          onChange(value.slice(0, -1));
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  const atMax = max !== undefined && value.length >= max;

  return (
    <div ref={rootRef} className="relative">
      {/* combobox with chips inside */}
      <div
        onClick={() => !disabled && (inputRef.current?.focus(), setOpen(true))}
        className={cn(
          "flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-3 py-2 transition-colors",
          disabled && "cursor-not-allowed bg-paper-soft",
          open && !disabled
            ? "border-ink shadow-[0_0_0_3px_rgba(13,13,13,0.08)]"
            : "border-[#d9d9e0] hover:border-ink/50",
        )}
      >
        {value.map((p) => (
          <span
            key={p.ref}
            className={cn(
              "inline-flex max-w-56 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              p.kind === "INTERNAL" ? "bg-ink text-white" : "bg-paper-deep text-ink",
            )}
          >
            {p.kind === "EXTERNAL" && "خارجی · "}
            <span className="truncate">{p.name}</span>
            {p.company && <span className="opacity-70">({p.company})</span>}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x.ref !== p.ref));
              }}
              className="opacity-70 hover:opacity-100"
              aria-label={`حذف ${p.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          disabled={disabled || atMax}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setManualMode(false); }}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : atMax ? `حداکثر ${faNum(max)} نفر` : "افراد بیشتر…"}
          className="h-6 min-w-24 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
        />
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </div>

      {/* dropdown */}
      {open && !disabled && (
        <div className="absolute right-0 left-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-line bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          {/* manual form */}
          {manualMode ? (
            <div className="space-y-2 p-3">
              <p className="text-[12px] font-bold">افزودن فرد جدید به دایرکتوری</p>
              <input autoFocus value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="نام و نام خانوادگی *" className="h-10 w-full rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
              <div className="grid grid-cols-2 gap-2">
                <input value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} placeholder="شرکت / سازمان" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input value={manual.jobTitle} onChange={(e) => setManual({ ...manual, jobTitle: e.target.value })} placeholder="عنوان شغلی" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input dir="ltr" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} placeholder="تلفن" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
                <input dir="ltr" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} placeholder="ایمیل" className="h-10 rounded-md border border-line px-3 text-[12px] outline-none focus:border-ink" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveManualToDirectory} className="h-9 flex-1 rounded-md bg-ink text-[12px] font-medium text-white hover:bg-[#2a2a2e]">ذخیره و افزودن</button>
                <button type="button" onClick={() => setManualMode(false)} className="h-9 rounded-md border border-line px-3 text-[12px] text-ink-soft">انصراف</button>
              </div>
            </div>
          ) : (
            <div ref={listRef} className="max-h-72 overflow-y-auto">
              {/* search meta */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-3 py-2 text-[10px] text-ink-faint">
                <span className="flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  {debounced ? `نتایج «${debounced}»` : "همه"}
                  {isFetching && " · در حال جستجو…"}
                </span>
                <span>{faNum(totalPeople)} نفر در دایرکتوری</span>
              </div>

              {results.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-[12px] text-ink-faint">
                    {debounced ? "کسی با این مشخصات یافت نشد" : "دایرکتوری خالی است"}
                  </p>
                  {allowManual && debounced.length >= 2 && (
                    <button type="button" onClick={() => setManualMode(true)} className="mt-2 rounded-md bg-paper-soft px-3 py-1.5 text-[11px] hover:bg-paper-deep">
                      + ثبت «{debounced}» در دایرکتوری
                    </button>
                  )}
                </div>
              )}

              {visible.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-right transition-colors",
                    active === i ? "bg-paper-soft" : "bg-transparent",
                  )}
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
                        <span className="flex items-center gap-0.5"><Briefcase className="h-3 w-3" />{p.jobTitle}</span>
                      )}
                      {p.company && (
                        <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" />{p.company}</span>
                      )}
                      {p.phone && <span dir="ltr">{faStr(p.phone)}</span>}
                    </span>
                  </span>
                </button>
              ))}

              {/* show more — only first PAGE by default for 1000+ scale */}
              {results.length > PAGE && !showMore && (
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  className="w-full border-t border-line py-2.5 text-center text-[11px] text-ink-soft hover:bg-paper-soft"
                >
                  نمایش {faNum(results.length - PAGE)} نفر دیگر…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
