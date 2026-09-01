"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn, faStr, formatJalali, isoDateInTz } from "@/lib";
import { J_WEEKDAYS_LONG, iranianWeekdayIndex } from "@/lib/jalali";
import { DEFAULT_ORG_TIMEZONE, formatClockInTz, formatClockWithSecondsInTz } from "@/lib/timezone";
import { PRIVATE_DISPLAY_TITLE, normalizeDisplayCode, type DisplayOccupancy } from "@/lib/room-display";
import { toEnDigits } from "@/lib/fa";

interface DisplaySlot {
  title: string;
  startAt: string;
  endAt: string;
  isPrivate: boolean;
  isMasked: boolean;
  organizerName: string | null;
}

interface DisplayBoard {
  room: {
    id: string;
    name: string;
    isActive: boolean;
    branchName: string;
    floorName: string | null;
  };
  timezone: string;
  occupancy: DisplayOccupancy;
  current: DisplaySlot | null;
  next: DisplaySlot | null;
  serverNow: string;
}

const OCCUPANCY_FA: Record<DisplayOccupancy, string> = {
  AVAILABLE: "آزاد",
  OCCUPIED: "اشغال",
  DISABLED: "غیرفعال",
};

function storageKey(roomId: string) {
  return `mh-room-display:${roomId}`;
}

function readStored(roomId: string): { t?: string; code?: string } {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId));
    if (!raw) return {};
    return JSON.parse(raw) as { t?: string; code?: string };
  } catch {
    return {};
  }
}

function writeStored(roomId: string, creds: { t?: string; code?: string }) {
  try {
    sessionStorage.setItem(storageKey(roomId), JSON.stringify(creds));
  } catch {
    /* private mode */
  }
}

export function RoomDisplayPage({
  initialToken,
  initialCode,
}: {
  initialToken: string | null;
  initialCode: string | null;
}) {
  const { id: roomId } = useParams<{ id: string }>();
  const [creds, setCreds] = useState<{ t?: string; code?: string }>(() => ({
    t: initialToken ?? undefined,
    code: initialCode ?? undefined,
  }));
  const [codeInput, setCodeInput] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const stored = readStored(roomId);
    setCreds((prev) => ({
      t: prev.t || stored.t,
      code: prev.code || stored.code,
    }));
  }, [roomId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    if (creds.t) qs.set("t", creds.t);
    if (creds.code) qs.set("code", creds.code);
    const suffix = qs.toString();
    return `/api/rooms/${roomId}/display${suffix ? `?${suffix}` : ""}`;
  }, [roomId, creds.t, creds.code]);

  const { data, error, isError, isPending } = useQuery({
    queryKey: ["room-display", roomId, creds.t, creds.code],
    queryFn: () => api<DisplayBoard>(query),
    refetchInterval: 15_000,
    retry: false,
  });

  useEffect(() => {
    if (data) writeStored(roomId, creds);
  }, [data, roomId, creds]);

  const needsGate = isError && (error as ApiError | undefined)?.status === 401;

  const tz = data?.timezone ?? DEFAULT_ORG_TIMEZONE;
  const occupancy = data?.occupancy ?? "AVAILABLE";
  const iso = isoDateInTz(now, tz);
  const weekday = J_WEEKDAYS_LONG[iranianWeekdayIndex(iso)] ?? "";

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeDisplayCode(toEnDigits(codeInput));
    if (code.length !== 8) return;
    setCreds({ code });
  }

  if (!data && isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-ink text-white/70" dir="rtl">
        در حال بارگذاری نمایشگر…
      </div>
    );
  }

  if (needsGate && !data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-ink px-6 text-white" dir="rtl">
        <Image src="/logo-white.png" alt="مهرسا" width={56} height={56} className="h-14 w-14 object-contain" priority />
        <h1 className="mt-6 text-3xl font-bold">نمایشگر اتاق</h1>
        <p className="mt-2 max-w-md text-center text-[16px] text-white/70">
          کد ۸ رقمی نمایشگر را وارد کنید، یا لینک توکن‌دار را روی تبلت کنار در باز کنید.
        </p>
        <form onSubmit={submitCode} className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(toEnDigits(e.target.value).toUpperCase().slice(0, 8))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            dir="ltr"
            placeholder="A1B2C3D4"
            className="h-16 rounded-xl border border-white/20 bg-white/10 px-4 text-center text-2xl tracking-[0.35em] text-white outline-none focus:border-white"
            aria-label="کد نمایشگر اتاق"
          />
          {(error as ApiError | undefined)?.message && (
            <p className="text-center text-[14px] text-red-200">{(error as ApiError).message}</p>
          )}
          <Button type="submit" className="h-14 text-[16px]" disabled={normalizeDisplayCode(codeInput).length !== 8}>
            ورود به نمایشگر
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div
      data-testid="room-display"
      dir="rtl"
      className={cn(
        "flex min-h-[100dvh] flex-col px-8 py-6 text-white sm:px-12 sm:py-8",
        occupancy === "OCCUPIED" && "bg-[#8a1c1c]",
        occupancy === "AVAILABLE" && "bg-[#14532d]",
        occupancy === "DISABLED" && "bg-[#27272a]",
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo-white.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
          <div>
            <p className="text-[13px] font-medium text-white/70">مهرسا</p>
            <p className="text-[15px] text-white/55">نمایشگر کنار در</p>
          </div>
        </div>
        <div className="text-left" dir="rtl">
          <p data-testid="room-display-clock" className="font-bold tabular-nums leading-none tracking-tight text-[clamp(2.5rem,8vw,5.5rem)]">
            {formatClockWithSecondsInTz(now, tz)}
          </p>
          <p className="mt-2 text-[clamp(1rem,2.4vw,1.5rem)] text-white/80">
            {weekday} {formatJalali(now, { monthName: true, tz })}
          </p>
        </div>
      </header>

      <main className="mt-8 flex flex-1 flex-col justify-center gap-8">
        <div className="text-center">
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight">{data?.room.name ?? "اتاق"}</h1>
          <p className="mt-2 text-[clamp(1rem,2.2vw,1.4rem)] text-white/75">
            {data?.room.branchName}
            {data?.room.floorName ? ` · ${data.room.floorName}` : ""}
          </p>
          <p
            data-testid="room-display-occupancy"
            className="mt-6 inline-flex rounded-full bg-white/15 px-8 py-3 text-[clamp(1.75rem,4.5vw,3.25rem)] font-bold tracking-wide"
          >
            {OCCUPANCY_FA[occupancy]}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <SlotCard kind="current" slot={data?.current ?? null} tz={tz} />
          <SlotCard kind="next" slot={data?.next ?? null} tz={tz} />
        </div>
      </main>
    </div>
  );
}

function SlotCard({
  kind,
  slot,
  tz,
}: {
  kind: "current" | "next";
  slot: DisplaySlot | null;
  tz: string;
}) {
  return (
    <section className="rounded-3xl bg-black/20 p-6 sm:p-8">
      <p className="text-[15px] font-medium text-white/65">{kind === "current" ? "جلسه جاری" : "جلسه بعدی"}</p>
      {slot ? (
        <>
          <h2
            data-testid={kind === "current" ? "room-display-current-title" : "room-display-next-title"}
            className="mt-3 text-[clamp(1.4rem,3.2vw,2.25rem)] font-bold leading-snug"
          >
            {slot.isMasked ? PRIVATE_DISPLAY_TITLE : slot.title}
          </h2>
          <p className="mt-3 text-[clamp(1.1rem,2.4vw,1.6rem)] tabular-nums text-white/85">
            {formatClockInTz(new Date(slot.startAt), tz)} تا {formatClockInTz(new Date(slot.endAt), tz)}
          </p>
          {slot.organizerName && (
            <p className="mt-2 text-[clamp(0.95rem,1.8vw,1.2rem)] text-white/70">{slot.organizerName}</p>
          )}
        </>
      ) : (
        <p className="mt-4 text-[clamp(1.2rem,2.6vw,1.75rem)] text-white/55">
          {kind === "current" ? "جلسه‌ای در جریان نیست" : "جلسه‌ای در صف نیست"}
        </p>
      )}
    </section>
  );
}
