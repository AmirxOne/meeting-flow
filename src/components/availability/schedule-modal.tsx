"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/jalali-date-picker";
import { faNum } from "@/lib";

/**
 * مودال تنظیم زمان‌بندی اعلام زمان آزاد — فردی یا گروهی.
 * اگر targetNames چند نفر باشد، عنوان «تنظیم گروهی» می‌شود.
 * حالت «خنثی»: با تیکِ «پیروی از تنظیم سازمان» فیلدها inherit می‌شوند (override=null).
 */

const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const PERIOD_OPTIONS: SelectOption[] = [
  { value: "NEXT_WEEK", label: "هفته‌ی آینده", hint: "شنبه تا جمعه‌ی بعدی" },
  { value: "THIS_WEEK", label: "هفته‌ی جاری", hint: "همین هفته" },
  { value: "NEXT_MONTH", label: "ماه آینده", hint: "کل ماه شمسیِ بعد" },
  { value: "THIS_MONTH", label: "ماه جاری", hint: "کل همین ماه شمسی" },
];

const DAY_OPTIONS: SelectOption[] = DAYS_FA.map((d, i) => ({ value: String(i), label: `هر ${d}` }));

export interface MemberOverrideValue {
  createDay: number | null;
  periodKind: string | null;
  deadlineDayOffset: number | null;
  deadlineMinutes: number | null;
}

export function ScheduleModal({
  open,
  onClose,
  targetNames,
  orgDefaults,
  current,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  targetNames: string[];
  orgDefaults: { createDay: number; periodKind: string; deadlineDayOffset: number; deadlineMinutes: number };
  current: MemberOverrideValue | null;
  busy: boolean;
  onSave: (v: MemberOverrideValue) => Promise<void>;
}) {
  const isInherit = current === null || (current.createDay === null && current.periodKind === null);
  const [inherit, setInherit] = useState(isInherit);
  const [createDay, setCreateDay] = useState(String(current?.createDay ?? orgDefaults.createDay));
  const [periodKind, setPeriodKind] = useState(current?.periodKind ?? orgDefaults.periodKind);
  const [deadlineDay, setDeadlineDay] = useState(String(current?.deadlineDayOffset ?? orgDefaults.deadlineDayOffset));
  const dm = current?.deadlineMinutes ?? orgDefaults.deadlineMinutes;
  const [deadlineTime, setDeadlineTime] = useState(`${String(Math.floor(dm / 60)).padStart(2, "0")}:${String(dm % 60).padStart(2, "0")}`);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const inh = current === null || (current.createDay === null && current.periodKind === null);
    setInherit(inh);
    setCreateDay(String(current?.createDay ?? orgDefaults.createDay));
    setPeriodKind(current?.periodKind ?? orgDefaults.periodKind);
    setDeadlineDay(String(current?.deadlineDayOffset ?? orgDefaults.deadlineDayOffset));
    const m = current?.deadlineMinutes ?? orgDefaults.deadlineMinutes;
    setDeadlineTime(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }, [open, current, orgDefaults]);

  const isGroup = targetNames.length > 1;
  const title = isGroup ? `تنظیم گروهی زمان‌بندی (${faNum(targetNames.length)} نفر)` : `زمان‌بندی اعلام زمان — ${targetNames[0] ?? ""}`;

  const deadlineDayOptions: SelectOption[] = [
    { value: "0", label: "همان روز", hint: "روزِ ایجاد درخواست" },
    { value: "1", label: "۱ روز بعد" },
    { value: "2", label: "۲ روز بعد" },
    { value: "3", label: "۳ روز بعد" },
    { value: "7", label: "۱ هفته بعد" },
  ];

  async function save() {
    setSaving(true);
    try {
      if (inherit) {
        await onSave({ createDay: null, periodKind: null, deadlineDayOffset: null, deadlineMinutes: null });
      } else {
        const [h, m] = deadlineTime.split(":").map(Number);
        await onSave({
          createDay: Number(createDay),
          periodKind,
          deadlineDayOffset: Number(deadlineDay),
          deadlineMinutes: (h * 60 + m),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="هر هفته در روزِ انتخاب‌شده، برای این افراد درخواست اعلام زمان ساخته می‌شود"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving || busy}>انصراف</Button>
          <Button onClick={save} disabled={saving || busy}>
            {saving || busy ? "در حال ذخیره…" : "ذخیره و مشمول کردن"}
          </Button>
        </div>
      }
    >
      <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-paper-soft/40 p-3">
        <input
          type="checkbox"
          checked={inherit}
          onChange={(e) => setInherit(e.target.checked)}
          className="size-4 accent-black"
        />
        <span className="text-[12.5px]">
          <b className="font-medium">پیروی از تنظیم سازمان</b>
          <span className="mr-1 text-ink-faint">
            (هر {DAYS_FA[orgDefaults.createDay]} · {PERIOD_OPTIONS.find((o) => o.value === orgDefaults.periodKind)?.label})
          </span>
        </span>
      </label>

      <div className={`grid gap-3 transition-opacity sm:grid-cols-2 ${inherit ? "pointer-events-none opacity-40" : ""}`}>
        <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
          روز ایجاد درخواست
          <Select value={createDay} onChange={setCreateDay} options={DAY_OPTIONS} />
        </label>
        <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
          اعلام زمان‌های آزادِ چه بازه‌ای؟
          <Select value={periodKind} onChange={setPeriodKind} options={PERIOD_OPTIONS} />
        </label>
        <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
          مهلت ثبت
          <Select value={deadlineDay} onChange={setDeadlineDay} options={deadlineDayOptions} />
        </label>
        <label className="flex flex-col gap-1.5 text-[11.5px] text-ink-faint">
          ساعت مهلت
          <div className="h-11"><TimePicker value={deadlineTime} onChange={setDeadlineTime} className="grid-cols-2 [&>div>button]:h-11" /></div>
        </label>
      </div>
    </Modal>
  );
}
