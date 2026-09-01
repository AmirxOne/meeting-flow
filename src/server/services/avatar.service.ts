import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";
import {
  AVATAR_EXTS,
  AVATAR_MAX_BYTES,
  AVATAR_MIMES,
  avatarStorageKey,
  mimeForAvatarExt,
  publicAvatarPath,
} from "@/lib/avatar";
import { sniffAttachment } from "@/server/services/attachment-scan";
import {
  readAttachmentBuffer,
  removeAttachmentFile,
  writeAttachment,
} from "@/server/services/attachment-storage";

export function sniffAvatarImage(buf: Buffer, originalName: string) {
  if (buf.length > AVATAR_MAX_BYTES) {
    throw new HttpError(400, "حجم تصویر حداکثر ۲ مگابایت است", "FILE_TOO_LARGE");
  }
  const sniffed = sniffAttachment(buf, originalName);
  if (!AVATAR_MIMES.has(sniffed.mime)) {
    throw new HttpError(400, "فقط تصویر (JPG، PNG، WebP یا GIF) مجاز است", "FILE_TYPE");
  }
  return sniffed;
}

async function removeAvatarFiles(orgId: string | null, userId: string): Promise<void> {
  await Promise.all(
    AVATAR_EXTS.map((ext) => removeAttachmentFile(avatarStorageKey(orgId, userId, ext))),
  );
}

async function readStoredAvatar(orgId: string | null, userId: string) {
  for (const ext of AVATAR_EXTS) {
    try {
      const body = await readAttachmentBuffer(avatarStorageKey(orgId, userId, ext));
      return { body, mimeType: mimeForAvatarExt(ext) };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw e;
    }
  }
  return null;
}

function canSeeAvatar(actor: AuthUser, target: { id: string; orgId: string | null }): boolean {
  if (actor.id === target.id) return true;
  if (actor.isPlatformAdmin) return true;
  return Boolean(target.orgId && target.orgId === actor.orgId);
}

export async function saveOwnAvatar(
  userId: string,
  file: { buffer: Buffer; name: string },
): Promise<{ avatarUrl: string }> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, orgId: true, isActive: true },
  });
  if (!target) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");
  if (!target.isActive) throw new HttpError(403, "حساب غیرفعال است", "FORBIDDEN");

  const sniffed = sniffAvatarImage(file.buffer, file.name);
  await removeAvatarFiles(target.orgId, userId);
  await writeAttachment(avatarStorageKey(target.orgId, userId, sniffed.ext), file.buffer);
  const avatarUrl = publicAvatarPath(userId, Date.now());
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  return { avatarUrl };
}

export async function deleteOwnAvatar(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, orgId: true, isActive: true },
  });
  if (!target) throw new HttpError(404, "کاربر یافت نشد", "NOT_FOUND");
  if (!target.isActive) throw new HttpError(403, "حساب غیرفعال است", "FORBIDDEN");
  await removeAvatarFiles(target.orgId, userId);
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
}

export async function readOrgAvatar(actor: AuthUser, userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, orgId: true, avatarUrl: true },
  });
  if (!target || !canSeeAvatar(actor, target) || !target.avatarUrl) {
    throw new HttpError(404, "تصویر پروفایل یافت نشد", "NO_AVATAR");
  }
  const file = await readStoredAvatar(target.orgId, userId);
  if (!file) throw new HttpError(404, "تصویر پروفایل یافت نشد", "NO_AVATAR");
  return file;
}

export function avatarImageResponse(body: Buffer, mimeType: string) {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
