"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardHeader, CardBody, SkeletonBlock, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badges";
import { cn, faNum, faStr, formatJalali, EQUIPMENT_FA, pad2 } from "@/lib";
import { Tooltip } from "@/components/ui/tooltip";
import { RoomDisplaySetup } from "@/components/rooms/room-display-setup";
import { QRCodeSVG } from "qrcode.react";

interface RoomDetail {
  room: {
    id: string;
    name: string;
    capacity: number;
    description: string | null;
    isVip: boolean;
    isActive: boolean;
    openTime: string | null;
    closeTime: string | null;
    minDurationMin: number;
    maxDurationMin: number;
    branch: { id: string; name: string };
    floor: { name: string; number: number } | null;
    equipment: { equipment: string }[];
    manager: { fullName: string } | null;
    publicSlug: string | null;
  };
  meetings: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    organizer: { fullName: string };
    _count: { participants: number };
  }[];
  status: string;
  current: { id: string; title: string; endAt: string } | null;
  next: { id: string; title: string; startAt: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "آزاد",
  OCCUPIED: "در جلسه",
  RESERVED: "رزرو شده",
  DISABLED: "غیرفعال",
};

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["room", id],
    queryFn: () => api<RoomDetail>(`/api/rooms/${id}`),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="h-3.5 w-56" />
          </div>
          <SkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="mt-1 h-3 w-32" />
            </div>
            <div className="p-5">
              <SkeletonBlock className="mb-4 h-10 rounded-md" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line py-3 last:border-0">
                  <div className="space-y-1.5">
                    <SkeletonBlock className="h-4 w-44" />
                    <SkeletonBlock className="h-3 w-56" />
                  </div>
                  <SkeletonBlock className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="border-b border-line px-5 py-4">
              <SkeletonBlock className="h-4 w-24" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="h-3.5 w-16" />
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-5 w-16 rounded-full" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const { room, meetings } = data;
  const t = new Date(Date.now() + 210 * 60000);
  const dayStartMin = 8 * 60;
  const dayEndMin = 20 * 60;
  const minutesOf = (iso: string) => {
    const lt = new Date(new Date(iso).getTime() + 210 * 60000);
    return lt.getUTCHours() * 60 + lt.getUTCMinutes();
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{room.name}</h1>
          <p className="mt-0.5 text-[12px] text-ink-soft">
            {room.branch.name}
            {room.floor ? ` · ${room.floor.name}` : ""}
            {room.manager ? ` · مدیر اتاق: ${room.manager.fullName}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "badge",
            data.status === "AVAILABLE" && "badge-green",
            data.status === "OCCUPIED" && "badge-red",
            data.status === "RESERVED" && "badge-amber",
            data.status === "DISABLED" && "badge-gray",
          )}
        >
          {STATUS_LABEL[data.status]}
        </span>
        <RoomQrPanel slug={room.publicSlug ?? null} name={room.name} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="برنامه امروز"
            subtitle={formatJalali(new Date(), { monthName: true })}
          />
          <CardBody>
            {meetings.length === 0 ? (
              <EmptyState title="امروز جلسه‌ای در این اتاق نیست" />
            ) : (
              <>
                {/* Outlook-style day bar — colored blocks with titles, now-marker */}
                <div dir="rtl" className="mb-5">
                  {/* hour header */}
                  <div className="relative mb-1 h-4">
                    {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                      <span
                        key={h}
                        className="absolute top-0 text-[9px] tabular-nums text-ink-faint"
                        style={{
                          right: `${((h * 60 - dayStartMin) / (dayEndMin - dayStartMin)) * 100}%`,
                          transform: "translateX(50%)",
                        }}
                      >
                        {faStr(pad2(h))}
                      </span>
                    ))}
                  </div>
                  {/* blocks lane */}
                  <div className="relative h-14 rounded-lg border border-line bg-paper-soft/40">
                    {/* hour gridlines */}
                    {[9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
                      <span
                        key={h}
                        className="absolute inset-y-0 w-px bg-line/60"
                        style={{ right: `${((h * 60 - dayStartMin) / (dayEndMin - dayStartMin)) * 100}%` }}
                      />
                    ))}
                    {meetings
                      .filter((m) => !["CANCELLED", "REJECTED"].includes(m.status))
                      .map((m) => {
                        const s = minutesOf(m.startAt);
                        const e = minutesOf(m.endAt);
                        const right = ((Math.max(s, dayStartMin) - dayStartMin) / (dayEndMin - dayStartMin)) * 100;
                        const width = Math.max(
                          ((Math.min(e, dayEndMin) - Math.max(s, dayStartMin)) / (dayEndMin - dayStartMin)) * 100,
                          2.5,
                        );
                        const live = m.status === "IN_PROGRESS";
                        const pending = m.status === "PENDING_APPROVAL" || m.status === "WAITLISTED" || m.status === "WAITLIST_OFFERED";
                        return (
                          <Tooltip
                            key={m.id}
                            content={`${m.title} · ${faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}`}
                          >
                            <div
                              className={cn(
                                "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border px-1.5 py-1 text-right",
                                live
                                  ? "border-red-300 bg-red-500/90 text-white"
                                  : pending
                                    ? "border-dashed border-ink/40 bg-white text-ink-soft"
                                    : "border-ink/20 bg-ink text-white",
                              )}
                              style={{ right: `${right}%`, width: `${width}%` }}
                            >
                              <p className="truncate text-[9px] font-bold leading-3">{m.title}</p>
                              {width > 14 && (
                                <p className="mt-0.5 truncate text-[8px] leading-3 opacity-80">
                                  {faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}
                                </p>
                              )}
                            </div>
                          </Tooltip>
                        );
                      })}
                    {/* now marker */}
                    {(() => {
                      const nowTeh = new Date(Date.now() + 210 * 60000);
                      const nowMin = nowTeh.getUTCHours() * 60 + nowTeh.getUTCMinutes();
                      if (nowMin < dayStartMin || nowMin > dayEndMin) return null;
                      const right = ((nowMin - dayStartMin) / (dayEndMin - dayStartMin)) * 100;
                      return (
                        <span
                          className="absolute inset-y-0 z-10 w-0.5 bg-red-500"
                          style={{ right: `${right}%` }}
                          title="الان"
                        >
                          <span className="absolute -top-0.5 right-1/2 h-1.5 w-1.5 translate-x-1/2 rounded-full bg-red-500" />
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-ink-faint">
                  <span className="flex items-center gap-1"><span className="h-2 w-3.5 rounded-sm bg-ink" />تأییدشده</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-3.5 rounded-sm bg-red-500" />در حال برگزاری</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-3.5 rounded-sm border border-dashed border-ink/50 bg-white" />در انتظار تأیید</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-3.5 rounded-sm bg-red-500" style={{ width: 2 }} />الان</span>
                </div>

                <div className="divide-y divide-line">
                  {meetings.map((m) => (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className={cn(
                        "flex items-center justify-between gap-2 px-1 py-3 hover:bg-paper-soft",
                        ["CANCELLED", "REJECTED"].includes(m.status) && "opacity-50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn("truncate text-[13px] font-medium", ["CANCELLED", "REJECTED"].includes(m.status) && "line-through")}>{m.title}</p>
                        <p className="mt-0.5 text-[11px] text-ink-soft">
                          {faStr(new Date(new Date(m.startAt).getTime() + 210 * 60000).toISOString().slice(11, 16))} —{" "}
                          {faStr(new Date(new Date(m.endAt).getTime() + 210 * 60000).toISOString().slice(11, 16))}
                          {" · "}
                          {m.organizer.fullName}
                          {" · "}
                          {faNum(m._count.participants)} نفر
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
        <Card>
          <CardHeader title="مشخصات اتاق" />
          <CardBody className="space-y-3 text-[12px]">
            <Row label="ظرفیت" value={`${faNum(room.capacity)} نفر`} />
            <Row label="مدیر اتاق" value={room.manager?.fullName ?? "—"} />
            <Row label="اتاق VIP" value={room.isVip ? "بله" : "خیر"} />
            <Row label="حداقل مدت رزرو" value={`${faNum(room.minDurationMin)} دقیقه`} />
            <Row label="حداکثر مدت رزرو" value={`${faNum(room.maxDurationMin)} دقیقه`} />
            {room.openTime && (
              <Row label="ساعات کاری" value={`${faStr(room.openTime)} تا ${faStr(room.closeTime ?? "")}`} />
            )}
            <div>
              <p className="text-ink-soft">تجهیزات</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {room.equipment.length === 0 && <span className="text-ink-faint">—</span>}
                {room.equipment.map((e) => (
                  <span key={e.equipment} className="badge badge-gray">
                    {EQUIPMENT_FA[e.equipment] ?? e.equipment}
                  </span>
                ))}
              </div>
            </div>
            {room.description && (
              <div>
                <p className="text-ink-soft">توضیحات</p>
                <p className="mt-1 leading-5">{room.description}</p>
              </div>
            )}
          </CardBody>
        </Card>
        <RoomDisplaySetup roomId={room.id} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}


/** QR panel — printable poster: scan to see this room's live agenda (no login). */
function RoomQrPanel({ slug, name }: { slug: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  if (!slug) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : `/r/${slug}`;

  function downloadPng() {
    const svg = document.querySelector("#room-qr-svg") as SVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-${slug}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-[12px] font-medium text-ink-soft transition-colors hover:bg-paper-soft"
      >
        <QRCodeSVG value={url} size={14} level="M" />
        QR اتاق
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            dir="rtl"
            className="w-[340px] rounded-xl bg-white p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] font-bold">{name}</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              با اسکن این کد، برنامه‌ی اتاق بدون ورود به سامانه دیده می‌شود
            </p>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-line p-3" id="room-qr-wrap">
              <QRCodeSVG id="room-qr-svg" value={url} size={220} level="M" />
            </div>
            <p dir="ltr" className="mt-3 break-all text-[10px] text-ink-faint">
              {url}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={downloadPng}
                className="h-9 rounded-md bg-ink px-4 text-[12px] font-medium text-white"
              >
                دانلود PNG
              </button>
              <button
                onClick={() => window.print()}
                className="h-9 rounded-md border border-line px-4 text-[12px] text-ink-soft"
              >
                چاپ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
