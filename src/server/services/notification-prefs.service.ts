import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import {
  buildNotifPrefsView,
  mergeNotifPrefs,
  parseOrgNotifChannels,
  parseStoredNotifPrefs,
  type NotifPrefMatrix,
} from "@/lib/notification-prefs";

export async function getNotificationPrefsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true, notificationPrefs: true },
  });
  if (!user) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");

  const hasPush =
    (await prisma.pushSubscription.count({ where: { userId } })) > 0;

  return buildNotifPrefsView({
    prefs: parseStoredNotifPrefs(user.notificationPrefs),
    orgChannels: parseOrgNotifChannels(),
    hasPhone: !!user.phone?.trim(),
    hasEmail: !!user.email?.trim(),
    hasPush,
  });
}

export async function patchNotificationPrefsForUser(userId: string, patch: NotifPrefMatrix) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  if (!user) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");

  const merged = mergeNotifPrefs(parseStoredNotifPrefs(user.notificationPrefs), patch);
  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: merged as Prisma.InputJsonValue },
  });
  return getNotificationPrefsForUser(userId);
}
