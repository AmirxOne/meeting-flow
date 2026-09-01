"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { api, type ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { RESPONSE_FA } from "@/lib";
import { canShowMeetingRsvp } from "@/lib/meeting-period";

export { canShowMeetingRsvp };

/** Accept / decline on the meetings list (same POST as the detail page). */
export function MeetingRsvpBar({
  meetingId,
  status,
  myResponseStatus,
}: {
  meetingId: string;
  status: string;
  myResponseStatus: string | null;
}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (!canShowMeetingRsvp(myResponseStatus, status)) return null;

  async function respond(responseStatus: "ACCEPTED" | "DECLINED") {
    setBusy(responseStatus);
    try {
      await api(`/api/meetings/${meetingId}/participants/respond`, {
        method: "POST",
        json: { responseStatus },
      });
      push("پاسخ شما ثبت شد", "success");
      await qc.invalidateQueries({ queryKey: ["meetings"] });
    } catch (e) {
      push((e as ApiError).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      data-tour="meeting-rsvp"
      className="mt-3 grid w-full grid-cols-2 gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size="sm"
        className="min-w-0 w-full"
        variant={myResponseStatus === "ACCEPTED" ? "primary" : "secondary"}
        loading={busy === "ACCEPTED"}
        aria-label="قبول دعوت"
        data-testid="rsvp-accept"
        onClick={() => respond("ACCEPTED")}
      >
        <Check className="h-4 w-4 shrink-0" />
        قبول
      </Button>
      <Button
        type="button"
        size="sm"
        className="min-w-0 w-full"
        variant={myResponseStatus === "DECLINED" ? "primary" : "outline"}
        loading={busy === "DECLINED"}
        aria-label="رد دعوت"
        data-testid="rsvp-decline"
        onClick={() => respond("DECLINED")}
      >
        <X className="h-4 w-4 shrink-0" />
        رد
      </Button>
      <p className="col-span-2 text-center text-[11px] text-ink-faint">
        وضعیت: {RESPONSE_FA[myResponseStatus!] ?? myResponseStatus}
      </p>
    </div>
  );
}
