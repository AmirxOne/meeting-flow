import { prisma } from "@/server/db";
import { HttpError, type AuthUser } from "@/server/auth/session";
import { sniffAttachment } from "@/server/services/attachment-scan";
import {
  readAttachmentBuffer,
  removeAttachmentFile,
  writeAttachment,
} from "@/server/services/attachment-storage";
import { NextResponse } from "next/server";

/** محدودیت‌های لوگوی سازمان */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // ۲ مگابایت
const LOGO_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
const LOGO_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function logoStorageKey(orgId: string, ext: string) {
  return `orgs/${orgId}/logo.${ext}`;
}

/** آپلود/جایگزینی لوگوی سازمان (org:manage). قواعد: فقط تصویر، سقف ۲MB. */
export async function saveOrgLogo(
  actor: AuthUser,
  file: { buffer: Buffer; name: string },
): Promise<{ logoUrl: string }> {
  if (file.buffer.length > LOGO_MAX_BYTES) {
    throw new HttpError(400, "حجم لوگو حداکثر ۲ مگابایت است", "FILE_TOO_LARGE");
  }
  const sniffed = sniffAttachment(file.buffer, file.name);
  if (!LOGO_MIMES.has(sniffed.mime)) {
    throw new HttpError(400, "فقط تصویر (PNG، JPG، WebP، GIF یا SVG) مجاز است", "FILE_TYPE");
  }

  const org = await prisma.organization.findUnique({ where: { id: actor.orgId }, select: { id: true } });
  if (!org) throw new HttpError(404, "سازمان یافت نشد", "NOT_FOUND");

  // حذف لوگوهای قبلی (هر پسوندی)
  await Promise.all(LOGO_EXTS.map((ext) => removeAttachmentFile(logoStorageKey(org.id, ext)).catch(() => {})));
  await writeAttachment(logoStorageKey(org.id, sniffed.ext), file.buffer);

  const logoUrl = `/api/public/organization/logo?v=${Date.now()}`;
  await prisma.organization.update({ where: { id: org.id }, data: { logoUrl } });
  return { logoUrl };
}

/** حذف لوگو (برگشت به پیش‌فرض). */
export async function deleteOrgLogo(actor: AuthUser): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: actor.orgId }, select: { id: true } });
  if (!org) throw new HttpError(404, "سازمان یافت نشد", "NOT_FOUND");
  await Promise.all(LOGO_EXTS.map((ext) => removeAttachmentFile(logoStorageKey(org.id, ext)).catch(() => {})));
  await prisma.organization.update({ where: { id: org.id }, data: { logoUrl: null } });
}

/** خواندن فایل لوگوی سازمان — عمومی (بدون لاگین، برای صفحه‌ی لاگین/لندینگ). */
export async function readOrgLogo(orgId: string) {
  for (const ext of LOGO_EXTS) {
    try {
      const body = await readAttachmentBuffer(logoStorageKey(orgId, ext));
      const mime =
        ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
      return { body, mimeType: mime };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw e;
    }
  }
  return null;
}

export function logoImageResponse(body: Buffer, mimeType: string) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": mimeType,
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
