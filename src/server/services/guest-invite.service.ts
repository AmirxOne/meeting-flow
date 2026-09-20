// Guest invitations — external (non-member) participants of a meeting get
// SMS/email invitations through the same provider ports as members.
// Results (sent/failed + error) are recorded in AuditLog for traceability.

import type { Meeting } from "@prisma/client";
import { prisma } from "@/server/db";
import { getEmailProvider } from "./email-provider";
import { getSmsProvider } from "./sms-provider";
import { getOrgTimezone } from "./org-timezone.service";
import { formatDateTimeInTz } from "@/lib/timezone";
import { guestInviteEmailTemplate } from "@/lib/email-templates";

export type GuestInviteResult = {
  guestId: string;
  name: string;
  phoneSent: boolean;
  emailSent: boolean;
  error?: string;
};

function guestSmsText(meeting: Meeting, when: string, place: string): string {
  return [
    `دعوت به جلسه «${meeting.title}»`,
    when,
    place,
    `درخواست‌دهنده: سامانه مهرسا`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 300);
}

/**
 * Send invitations to the external guests of a meeting via SMS/email.
 * Never throws — each guest is tried independently; failures recorded.
 */
export async function sendGuestInvites(
  meeting: Meeting,
  actorId: string,
  ip?: string | null,
): Promise<GuestInviteResult[]> {
  const guests = await prisma.meetingGuest.findMany({
    where: { meetingId: meeting.id },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (guests.length === 0) return [];

  const tz = await getOrgTimezone();
  const when = `${formatDateTimeInTz(meeting.startAt, tz)} تا ${formatDateTimeInTz(meeting.endAt, tz)}`;
  const place = meeting.videoUrl
    ? `آنلاین: ${meeting.videoUrl}`
    : meeting.roomId
      ? "در محل شرکت — اتاق جلسات"
      : `بیرون از شرکت${meeting.description?.includes("📍") ? "" : ""}`;

  const sms = getSmsProvider();
  const email = getEmailProvider();

  const results: GuestInviteResult[] = [];
  for (const g of guests) {
    const res: GuestInviteResult = {
      guestId: g.id,
      name: g.name,
      phoneSent: false,
      emailSent: false,
    };
    if (g.phone) {
      try {
        await sms.send(g.phone, guestSmsText(meeting, when, place));
        res.phoneSent = true;
      } catch (e) {
        res.error = String((e as Error).message ?? e).slice(0, 200);
      }
    }
    if (g.email) {
      try {
        const tpl = guestInviteEmailTemplate({
          heading: `دعوت به جلسه «${meeting.title}»`,
          when,
          place,
        });
        await email.send(g.email, tpl.subject, tpl.text, tpl.html);
        res.emailSent = true;
      } catch (e) {
        res.error = (res.error ? res.error + " | " : "") + String((e as Error).message ?? e).slice(0, 200);
      }
    }
    results.push(res);
    await prisma.auditLog.create({
      data: {
        actorId,
        action: res.phoneSent || res.emailSent ? "GUEST_INVITE_SENT" : "GUEST_INVITE_FAILED",
        entity: "MeetingGuest",
        entityId: g.id,
        ip: ip ?? null,
        newValue: {
          meetingId: meeting.id,
          channels: [res.phoneSent ? "sms" : null, res.emailSent ? "email" : null].filter(Boolean),
          error: res.error ?? null,
        } as object,
      },
    }).catch(() => {});
  }
  return results;
}
