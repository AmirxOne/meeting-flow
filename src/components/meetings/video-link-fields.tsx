"use client";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib";
import { VIDEO_PROVIDER_OPTIONS, type VideoProvider } from "@/lib/video-link";

export function VideoLinkFields({
  provider,
  url,
  onProvider,
  onUrl,
  highlighted,
  hint,
}: {
  provider: string;
  url: string;
  onProvider: (v: string) => void;
  onUrl: (v: string) => void;
  highlighted?: boolean;
  hint?: string;
}) {
  return (
    <div
      data-testid="meeting-video-fields"
      data-tour="meeting-video-link"
      className={cn(
        "space-y-3 rounded-md border p-3.5",
        highlighted ? "border-ink bg-paper-soft" : "border-line bg-white",
      )}
    >
      <div>
        <p className="text-[12px] font-medium">لینک ویدئو {highlighted ? "" : "(اختیاری)"}</p>
        <p className="mt-1 text-[11px] leading-5 text-ink-soft">
          {hint ??
            (highlighted
              ? "برای جلسه آنلاین لینک گوگل میت، تیمز، زوم یا لینک سفارشی را وارد کنید."
              : "اگر جلسه هیبرید است می‌توانید لینک ویدئو اضافه کنید — برای جلسات حضوری خالی بگذارید.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium">نوع لینک</label>
          <Select
            value={provider}
            onChange={onProvider}
            placeholder="انتخاب نوع…"
            options={[{ value: "", label: "بدون لینک" }, ...VIDEO_PROVIDER_OPTIONS]}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-medium">آدرس</label>
          <input
            dir="ltr"
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://"
            className="h-11 w-full rounded-md border border-[#d9d9e0] px-3.5 text-left text-[13px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/15"
            data-testid="video-url-input"
            inputMode="url"
            autoComplete="off"
            onFocus={() => {
              if (!provider) onProvider("CUSTOM" satisfies VideoProvider);
            }}
          />
        </div>
      </div>
    </div>
  );
}
