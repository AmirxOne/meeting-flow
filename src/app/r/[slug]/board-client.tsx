"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { faNum, formatJalali } from "@/lib";

type Meeting = {
  id: string;
  title: string;
  isPrivate: boolean;
  startAt: string;
  endAt: string;
  status: string;
  organizer: string | null;
};

/** Live room agenda — polls every 60s. Big, glanceable, Kiosk-style. */
export function RoomBoardClient({
  room,
}: {
  room: { name: string; capacity: number; branch: string; org: string; slug: string };
}) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/rooms/${room.slug}`, { cache: "no-store" });
        const j = await res.json();
        if (alive) {
          setMeetings(j?.data?.meetings ?? []);
          setErr(null);
        }
      } catch {
        if (alive) setErr("ارتباط با سرور برقرار نشد");
      }
    };
    load();
    const poll = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [room.slug]);

  const current = (meetings ?? []).find(
    (m) => new Date(m.startAt) <= now && now < new Date(m.endAt) && m.status !== "CANCELLED",
  );
  const upcoming = (meetings ?? []).filter((m) => new Date(m.startAt) > now);

  return (
    <div dir="rtl" className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-4xl p-6 sm:p-10">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[12px] text-white/50">{room.org} · {room.branch}</p>
            <h1 className="mt-1 text-[40px] font-bold leading-tight">{room.name}</h1>
            <p className="mt-2 text-[13px] text-white/60">
              ظرفیت {faNum(room.capacity)} نفر · {formatJalali(now, { withTime: true })}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={`/r/${room.slug}`} size={96} level="M" />
          </div>
        </div>

        {/* now */}
        <div className="mt-8">
          {meetings === null ? (
            <p className="text-white/50">در حال دریافت برنامه…</p>
          ) : current ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6">
              <p className="text-[12px] font-medium text-emerald-300">● در حال برگزاری</p>
              <p className="mt-2 text-[24px] font-bold">{current.title}</p>
              <p className="mt-1 text-[13px] text-white/60">
                {formatJalali(new Date(current.startAt), { withTime: true })} تا{" "}
                {new Date(current.endAt).toLocaleTimeString("fa-IR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {current.organizer ? ` · ${current.organizer}` : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-[12px] text-white/40">وضعیت فعلی</p>
              <p className="mt-2 text-[22px] font-bold text-emerald-300">اتاق آزاد است</p>
            </div>
          )}
        </div>

        {/* upcoming */}
        <div className="mt-6">
          <p className="mb-3 text-[13px] font-medium text-white/70">
            جلسات بعدی ({faNum(upcoming.length)})
          </p>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/50">
              برنامه‌ی دیگری برای امروز ثبت نشده است
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{m.title}</p>
                    {m.organizer && <p className="mt-0.5 text-[11px] text-white/40">{m.organizer}</p>}
                  </div>
                  <p className="shrink-0 text-[14px] tabular-nums text-white/70">
                    {new Date(m.startAt).toLocaleTimeString("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <p className="mt-6 text-[12px] text-red-300">{err}</p>}

        <p className="mt-10 text-center text-[11px] text-white/30">
          برای مشاهده‌ی همیشگی این صفحه، کد را با دوربین گوشی اسکن کنید
        </p>
      </div>
    </div>
  );
}
