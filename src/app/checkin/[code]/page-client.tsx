"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { api, type ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckinQrCode } from "@/components/checkin/checkin-qr-code";
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

export function PublicCheckinPage() {
  const rawCode = useParams<{ code: string }>().code;
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
    setError(null);
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

  const checkedIn = done || !!info?.guest.arrivedAt;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-paper-soft">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-6 sm:px-6 sm:pb-8 sm:pt-10">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink shadow-sm">
            <Image
              src="/logo-white.png"
              alt="مهرسا"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">ثبت حضور مهمان</h1>
          <p className="text-[13px] text-ink-soft">مهرسا — مدیریت جلسات سازمانی</p>
        </div>

        <div className="flex-1 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="skeleton mx-auto h-32 w-32 rounded-lg" />
              <div className="skeleton mx-auto h-4 w-3/4" />
              <div className="skeleton h-12 w-full rounded-lg" />
            </div>
          ) : error && !info ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-[14px] leading-relaxed text-red-700">
              {error}
            </div>
          ) : info ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <CheckinQrCode
                  checkinCode={code}
                  size={144}
                  guestName={info.guest.name}
                  meetingTitle={info.meeting.title}
                />
                <p className="text-center text-[11px] text-ink-faint">
                  QR همین صفحه — برای اشتراک یا چاپ در محل پذیرش
                </p>
              </div>

              <div className="rounded-xl border border-line bg-paper-soft/50 p-4 text-center">
                <p className="text-[12px] text-ink-soft">مهمان</p>
                <p className="mt-1 text-[18px] font-bold leading-snug">{info.guest.name}</p>
                {info.guest.company && (
                  <p className="mt-1 text-[13px] text-ink-faint">{info.guest.company}</p>
                )}
              </div>

              <div className="space-y-2 text-[13px] leading-relaxed">
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
                <p dir="ltr" className="text-center text-[11px] text-ink-faint">
                  کد: {faStr(info.guest.checkinCode ?? code)}
                </p>
              </div>

              {checkedIn ? (
                <div
                  className="rounded-xl border border-green-200 bg-green-50 p-5 text-center"
                  data-testid="checkin-success"
                >
                  <p className="text-[16px] font-bold text-green-800">حضور شما ثبت شد</p>
                  {info.guest.arrivedAt && (
                    <p className="mt-2 text-[12px] text-green-700">
                      {formatJalali(new Date(info.guest.arrivedAt), { withTime: true })}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-[12px] text-red-600">
                      {error}
                    </p>
                  )}
                  <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                    <Button
                      className="h-14 w-full touch-manipulation text-[16px] font-bold sm:h-12 sm:text-[15px]"
                      onClick={checkIn}
                      loading={busy}
                      data-testid="checkin-submit"
                    >
                      ثبت حضور
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
