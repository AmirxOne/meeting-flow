import { prisma } from "@/server/db";
import { faNum } from "@/lib/fa";

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<void>;

/** VAPID keys from env. Missing/short values → null (push stays off, never throws). */
export function parseVapidConfig(env: NodeJS.Dict<string> = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.VAPID_SUBJECT?.trim() || "mailto:noreply@example.com";
  if (publicKey.length < 20 || privateKey.length < 20) return null;
  return { publicKey, privateKey, subject };
}

export function reminderPushPayload(
  meetingTitle: string,
  offsetMin: number,
  meetingId: string,
): WebPushPayload {
  return {
    title: `یادآوری: جلسه «${meetingTitle}»`,
    body: offsetMin > 0 ? `${faNum(offsetMin)} دقیقه دیگر آغاز می‌شود` : "جلسه در حال شروع",
    url: `/meetings/${meetingId}`,
  };
}

export function invitePushPayload(
  title: string,
  body: string,
  meetingId: string,
): WebPushPayload {
  return {
    title,
    body,
    url: `/meetings/${meetingId}`,
  };
}

function isGoneStatus(err: unknown): boolean {
  const status = (err as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
}

async function defaultSender(vapid: VapidConfig): Promise<WebPushSender> {
  const webpush = await import("web-push");
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (subscription, payload) => {
    await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 });
  };
}

/**
 * Send a Web Push to one user.
 * Never throws: no VAPID, no subscription, or per-device send failure → skip.
 */
export async function sendWebPushToUser(
  userId: string | null | undefined,
  payload: WebPushPayload,
  opts?: {
    vapid?: VapidConfig | null;
    sender?: WebPushSender;
    subscriptions?: PushSubscriptionRecord[];
  },
): Promise<{ sent: number; skipped: string | null }> {
  if (!userId) return { sent: 0, skipped: "no-user" };

  const vapid = opts?.vapid !== undefined ? opts.vapid : parseVapidConfig();
  if (!vapid) return { sent: 0, skipped: "no-vapid" };

  let subs = opts?.subscriptions;
  if (!subs) {
    try {
      subs = await prisma.pushSubscription.findMany({
        where: { userId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
    } catch {
      return { sent: 0, skipped: "lookup-failed" };
    }
  }
  if (!subs.length) return { sent: 0, skipped: "no-subscription" };

  let sender = opts?.sender;
  if (!sender) {
    try {
      sender = await defaultSender(vapid);
    } catch {
      return { sent: 0, skipped: "sender-init" };
    }
  }

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/meetings",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await sender(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        json,
      );
      sent += 1;
    } catch (err) {
      if (isGoneStatus(err)) {
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
  return { sent, skipped: sent === 0 ? "send-failed" : null };
}

export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
  opts?: { vapid?: VapidConfig | null; sender?: WebPushSender },
): Promise<{ sent: number }> {
  const uniq = [...new Set(userIds)].filter(Boolean);
  let sent = 0;
  for (const id of uniq) {
    const result = await sendWebPushToUser(id, payload, opts);
    sent += result.sent;
  }
  return { sent };
}

export async function listPushStatus(userId: string) {
  const vapid = parseVapidConfig();
  const count = await prisma.pushSubscription.count({ where: { userId } });
  return {
    configured: !!vapid,
    vapidPublicKey: vapid?.publicKey ?? null,
    subscribed: count > 0,
    deviceCount: count,
  };
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function deletePushSubscriptions(userId: string, endpoint?: string) {
  return prisma.pushSubscription.deleteMany({
    where: endpoint ? { userId, endpoint } : { userId },
  });
}
