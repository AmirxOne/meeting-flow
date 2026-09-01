import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { sniffAttachment } from "@/server/services/attachment-scan";
import {
  readAttachmentBuffer,
  removeAttachmentFile,
  writeAttachment,
} from "@/server/services/attachment-storage";

const MAP_MAX_BYTES = 2 * 1024 * 1024;
const MAP_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function sniffMapImage(buf: Buffer, originalName: string) {
  if (buf.length > MAP_MAX_BYTES) {
    throw new HttpError(400, "حجم نقشه حداکثر ۲ مگابایت است", "FILE_TOO_LARGE");
  }
  const sniffed = sniffAttachment(buf, originalName);
  if (!MAP_MIMES.has(sniffed.mime)) {
    throw new HttpError(400, "فقط تصویر نقشه (JPG، PNG، WebP یا GIF) مجاز است", "FILE_TYPE");
  }
  return sniffed;
}

export async function saveMapFile(opts: {
  storageKey: string;
  previousKey: string | null;
  buffer: Buffer;
}): Promise<void> {
  if (opts.previousKey && opts.previousKey !== opts.storageKey) {
    await removeAttachmentFile(opts.previousKey);
  }
  await writeAttachment(opts.storageKey, opts.buffer);
}

export async function clearMapFile(storageKey: string | null): Promise<void> {
  if (!storageKey) return;
  await removeAttachmentFile(storageKey);
}

export async function uploadBranchMap(
  orgId: string,
  branchId: string,
  file: { buffer: Buffer; name: string },
) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  const sniffed = sniffMapImage(file.buffer, file.name);
  const storageKey = `maps/branch/${orgId}/${branchId}.${sniffed.ext}`;
  await saveMapFile({ storageKey, previousKey: branch.mapStorageKey, buffer: file.buffer });
  return prisma.branch.update({
    where: { id: branchId },
    data: { mapStorageKey: storageKey, mapMimeType: sniffed.mime },
    select: { id: true, mapMimeType: true },
  });
}

export async function deleteBranchMap(orgId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  await clearMapFile(branch.mapStorageKey);
  await prisma.branch.update({
    where: { id: branchId },
    data: { mapStorageKey: null, mapMimeType: null },
  });
}

export async function readBranchMap(orgId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, orgId },
    select: { mapStorageKey: true, mapMimeType: true },
  });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  if (!branch.mapStorageKey || !branch.mapMimeType) {
    throw new HttpError(404, "نقشه‌ای برای این شعبه ثبت نشده است", "NO_MAP");
  }
  const body = await readAttachmentBuffer(branch.mapStorageKey);
  return { body, mimeType: branch.mapMimeType };
}

export async function uploadFloorMap(
  orgId: string,
  branchId: string,
  floorId: string,
  file: { buffer: Buffer; name: string },
) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  const floor = await prisma.floor.findFirst({ where: { id: floorId, branchId } });
  if (!floor) throw new HttpError(404, "طبقه یافت نشد", "NOT_FOUND");
  const sniffed = sniffMapImage(file.buffer, file.name);
  const storageKey = `maps/floor/${orgId}/${floorId}.${sniffed.ext}`;
  await saveMapFile({ storageKey, previousKey: floor.mapStorageKey, buffer: file.buffer });
  return prisma.floor.update({
    where: { id: floorId },
    data: { mapStorageKey: storageKey, mapMimeType: sniffed.mime },
    select: { id: true, mapMimeType: true },
  });
}

export async function deleteFloorMap(orgId: string, branchId: string, floorId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  const floor = await prisma.floor.findFirst({ where: { id: floorId, branchId } });
  if (!floor) throw new HttpError(404, "طبقه یافت نشد", "NOT_FOUND");
  await clearMapFile(floor.mapStorageKey);
  await prisma.floor.update({
    where: { id: floorId },
    data: { mapStorageKey: null, mapMimeType: null },
  });
}

export async function readFloorMap(orgId: string, branchId: string, floorId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, orgId } });
  if (!branch) throw new HttpError(404, "شعبه یافت نشد", "NOT_FOUND");
  const floor = await prisma.floor.findFirst({
    where: { id: floorId, branchId },
    select: { mapStorageKey: true, mapMimeType: true },
  });
  if (!floor) throw new HttpError(404, "طبقه یافت نشد", "NOT_FOUND");
  if (!floor.mapStorageKey || !floor.mapMimeType) {
    throw new HttpError(404, "نقشه‌ای برای این طبقه ثبت نشده است", "NO_MAP");
  }
  const body = await readAttachmentBuffer(floor.mapStorageKey);
  return { body, mimeType: floor.mapMimeType };
}

export function mapImageResponse(body: Buffer, mimeType: string) {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
