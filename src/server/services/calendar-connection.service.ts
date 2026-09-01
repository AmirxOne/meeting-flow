import { prisma } from "@/server/db";
import { sealSecret } from "@/server/crypto/secret-box";
import { MOCK_CALENDAR_REFRESH } from "./google-calendar-oauth";

export type CalendarConnectionProvider = "google" | "mock" | "outlook";
export type CalendarConnectionFamily = "google" | "outlook";

export interface CalendarConnectionStatus {
  connected: boolean;
  provider: CalendarConnectionProvider | null;
  accountEmail: string | null;
  connectedAt: Date | null;
  configured: boolean;
}

const GOOGLE_FAMILY = ["google", "mock"] as const;
const OUTLOOK_FAMILY = ["outlook"] as const;

export function providersForFamily(family: CalendarConnectionFamily): readonly string[] {
  return family === "outlook" ? OUTLOOK_FAMILY : GOOGLE_FAMILY;
}

function pickStatusRow<T extends { provider: string }>(
  rows: T[],
  family: CalendarConnectionFamily,
): T | undefined {
  const allowed = new Set(providersForFamily(family));
  const matched = rows.filter((r) => allowed.has(r.provider));
  if (family === "google") {
    return matched.find((r) => r.provider === "google") ?? matched[0];
  }
  return matched[0];
}

export async function getUserCalendarStatus(
  userId: string,
  configured: boolean,
  family: CalendarConnectionFamily = "google",
): Promise<CalendarConnectionStatus> {
  const rows = await prisma.userCalendarConnection.findMany({ where: { userId } });
  const row = pickStatusRow(rows, family);
  if (!row) {
    return {
      connected: false,
      provider: null,
      accountEmail: null,
      connectedAt: null,
      configured,
    };
  }
  return {
    connected: true,
    provider: row.provider as CalendarConnectionProvider,
    accountEmail: row.accountEmail,
    connectedAt: row.connectedAt,
    configured,
  };
}

export async function upsertCalendarConnection(opts: {
  userId: string;
  provider: CalendarConnectionProvider;
  refreshToken: string;
  accountEmail?: string | null;
  calendarId?: string;
}): Promise<void> {
  const refreshTokenEnc = sealSecret(opts.refreshToken);
  await prisma.userCalendarConnection.upsert({
    where: { userId_provider: { userId: opts.userId, provider: opts.provider } },
    create: {
      userId: opts.userId,
      provider: opts.provider,
      refreshTokenEnc,
      accountEmail: opts.accountEmail ?? null,
      calendarId: opts.calendarId ?? "primary",
    },
    update: {
      refreshTokenEnc,
      accountEmail: opts.accountEmail ?? null,
      calendarId: opts.calendarId ?? "primary",
      connectedAt: new Date(),
    },
  });
}

export async function connectMockCalendar(userId: string, accountEmail: string): Promise<void> {
  await upsertCalendarConnection({
    userId,
    provider: "mock",
    refreshToken: MOCK_CALENDAR_REFRESH,
    accountEmail,
  });
}

export async function connectMockOutlook(userId: string, accountEmail: string): Promise<void> {
  await upsertCalendarConnection({
    userId,
    provider: "outlook",
    refreshToken: MOCK_CALENDAR_REFRESH,
    accountEmail,
    calendarId: "calendar",
  });
}

export async function disconnectCalendar(
  userId: string,
  providers?: readonly string[],
): Promise<void> {
  await prisma.userCalendarConnection.deleteMany({
    where: providers?.length ? { userId, provider: { in: [...providers] } } : { userId },
  });
}

/**
 * Organizer + invited users who have linked a calendar.
 * Returns every provider (Google and Outlook can both sync).
 * If both `google` and `mock` exist for one user, keep Google only.
 */
export async function listInvolvedCalendarConnections(meeting: {
  id: string;
  organizerId: string;
}) {
  const participants = await prisma.meetingParticipant.findMany({
    where: { meetingId: meeting.id },
    select: { userId: true },
  });
  const involved = [...new Set([meeting.organizerId, ...participants.map((p) => p.userId)])];
  const rows = await prisma.userCalendarConnection.findMany({
    where: { userId: { in: involved } },
  });

  const googleByUser = new Set(
    rows.filter((r) => r.provider === "google").map((r) => r.userId),
  );
  return rows.filter((row) => !(row.provider === "mock" && googleByUser.has(row.userId)));
}
