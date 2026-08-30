"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { faStr, formatJalali } from "@/lib";

interface CheckinInfo {
  guest: {
    id: string;
    name: string;
    company: string | null;
    arrivedAt: string | null;
    checkinCode: string | null;
  };
  meeting: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    branchName: string;
    roomName: string | null;
  };
}

export default function PublicCheckinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const [info, setInfo] = useState<CheckinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<CheckinInfo>(`/api/checkin/${encodeURIComponent(code)}`)
      .then((data) => {
        setInfo(data);
        setError(null);
        if (data.guest.arrivedAt) setDone(true);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  async function checkIn() {
    setBusy(true);
    try {
      const res = await api<{ guest: { arrivedAt: string }; alreadyCheckedIn: boolean }>(
        `/api/checkin/${encodeURIComponent(code)}`,
        { method: "POST" },
      );
      setDone(true);
      setInfo((prev) =>
        prev
          ? {
              ...prev,
              guest: { ...prev.guest, arrivedAt: res.guest.arrivedAt },
            }
          : prev,
      );
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-soft px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink">
            <Image src="/logo-white.png" alt="مهرسا" width={32} height={32} className="h-8 w-8 object-contain" />
          </div>
          <h1 className="text-lg font-bold">ثبت حضور مهمان</h1>
          <p className="text-[12px] text-ink-soft">مهرسا — مدیریت جلسات سازمانی</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton mx-auto h-4 w-3/4" />
            <div className="skeleton h-10 w-full" />
          </div>
        ) : error && !info ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center text-[13px] text-red-700">
            {error}
          </div>
        ) : info ? (
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-paper-soft/50 p-4 text-center">
              <p className="text-[12px] text-ink-soft">مهمان</p>
              <p className="mt-1 text-[16px] font-bold">{info.guest.name}</p>
              {info.guest.company && (
                <p className="mt-0.5 text-[12px] text-ink-faint">{info.guest.company}</p>
              )}
            </div>

            <div className="space-y-1.5 text-[12px]">
              <p>
                <span className="text-ink-soft">جلسه: </span>
                <span className="font-medium">{info.meeting.title}</span>
              </p>
              <p>
                <span className="text-ink-soft">زمان: </span>
                {formatJalali(new Date(info.meeting.startAt), { withTime: true })}
              </p>
              <p>
                <span className="text-ink-soft">مکان: </span>
                {info.meeting.branchName}
                {info.meeting.roomName ? ` · ${info.meeting.roomName}` : ""}
              </p>
              <p dir="ltr" className="text-[11px] text-ink-faint">
                کد: {faStr(info.guest.checkinCode ?? code)}
              </p>
            </div>

            {done || info.guest.arrivedAt ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-[14px] font-bold text-green-800">حضور شما ثبت شد</p>
                {info.guest.arrivedAt && (
                  <p className="mt-1 text-[11px] text-green-700">
                    {formatJalali(new Date(info.guest.arrivedAt), { withTime: true })}
                  </p>
                )}
              </div>
            ) : (
              <>
                {error && <p className="text-center text-[12px] text-red-600">{error}</p>}
                <Button className="w-full" onClick={checkIn} loading={busy}>
                  ثبت حضور
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
