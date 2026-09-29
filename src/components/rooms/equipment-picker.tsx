"use client";

import { useState } from "react";
import { cn, faNum, EQUIPMENT_LIST, EQUIPMENT_FA } from "@/lib";

/**
 * انتخاب‌گر تجهیزات اتاق — کارت‌های toggle با آیکون برای تجهیزات مرسوم،
 * به‌علاوه‌ی افزودن تجهیز دلخواه (دستی). مقدارها: کلید مرسوم (PROJECTOR…)
 * یا «CUSTOM:<نام>» برای سفارشی‌ها.
 */

function PresentationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="4" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 16V20M8.5 20H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 12.5V8.5L13 10.75L9.5 12.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function TvIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 20H15M12 17V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BoardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 18L10.5 15M16 18L13.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.5 9.5C9.5 8 11.5 8 12 9.5C12.5 11 14.5 11 15.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 10.5L20 8V16L15 13.5V10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="14.5" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 11C6 14.3 8.7 17 12 17C15.3 17 18 14.3 18 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 17V21M9.5 21H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CustomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 3" strokeLinecap="round" />
      <path d="M12 8.5V15.5M8.5 12H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const EQUIPMENT_ICON: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  PROJECTOR: PresentationIcon,
  TV: TvIcon,
  WHITEBOARD: BoardIcon,
  VIDEO_CONFERENCE: VideoIcon,
  AUDIO_SYSTEM: SpeakerIcon,
  MICROPHONE: MicIcon,
};

function CheckMini() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12.5L10 17.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CUSTOM_PREFIX = "CUSTOM:";

/** برچسب فارسی یک کلید تجهیز (مرسوم یا سفارشی) */
export function equipmentLabel(key: string): string {
  if (key.startsWith(CUSTOM_PREFIX)) return key.slice(CUSTOM_PREFIX.length);
  return EQUIPMENT_FA[key] ?? key;
}

export function EquipmentPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((x) => x !== key) : [...value, key]);
  }

  function addCustom() {
    const name = draft.trim();
    if (!name) return;
    const key = CUSTOM_PREFIX + name;
    if (!value.includes(key)) onChange([...value, key]);
    setDraft("");
  }

  const customSelected = value.filter((k) => k.startsWith(CUSTOM_PREFIX));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-ink-soft">تجهیزات اتاق</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums transition-colors",
            value.length > 0 ? "bg-ink text-white" : "bg-paper-soft text-ink-faint",
          )}
        >
          {faNum(value.length)} انتخاب‌شده
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EQUIPMENT_LIST.map((eq) => {
          const sel = value.includes(eq);
          const Icon = EQUIPMENT_ICON[eq];
          return (
            <button
              key={eq}
              type="button"
              aria-pressed={sel}
              onClick={() => toggle(eq)}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right transition-all",
                sel
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-line bg-white text-ink-soft hover:border-ink/30 hover:bg-paper-soft/50",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  sel ? "bg-white/15 text-white" : "bg-paper-soft text-ink-faint group-hover:text-ink-soft",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate text-[12px] font-medium">{EQUIPMENT_FA[eq]}</span>
              {sel && (
                <span className="absolute left-2 top-2 flex size-4 items-center justify-center rounded-full bg-white text-ink">
                  <CheckMini />
                </span>
              )}
            </button>
          );
        })}
        {/* تجهیزات سفارشیِ انتخاب‌شده */}
        {customSelected.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed
            onClick={() => toggle(k)}
            className="group relative flex items-center gap-2.5 rounded-xl border border-ink bg-ink px-3 py-2.5 text-right text-white shadow-sm transition-all"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
              <CustomIcon className="h-4 w-4" />
            </span>
            <span className="truncate text-[12px] font-medium">{equipmentLabel(k)}</span>
            <span className="absolute left-2 top-2 flex size-4 items-center justify-center rounded-full bg-white text-ink">
              <CheckMini />
            </span>
          </button>
        ))}
      </div>

      {/* افزودن تجهیز دلخواه */}
      <div className="mt-2.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="افزودن تجهیز دیگر… (مثلاً تابلو هوشمند)"
          className="h-9 min-w-0 flex-1 rounded-lg border border-dashed border-line bg-paper-soft/40 px-3 text-[12px] outline-none transition-colors placeholder:text-ink-faint focus:border-ink/40 focus:bg-white"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!draft.trim()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          افزودن
        </button>
      </div>
    </div>
  );
}
