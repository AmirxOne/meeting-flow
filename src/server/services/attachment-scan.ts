import path from "node:path";
import { HttpError } from "@/server/auth/session";

export interface SniffedAttachment {
  mime: string;
  ext: string;
}

type OfficeZip = "docx" | "xlsx" | "pptx";

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87 = Buffer.from("GIF87a");
const GIF89 = Buffer.from("GIF89a");
const PDF = Buffer.from("%PDF");
const ZIP = Buffer.from([0x50, 0x4b]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const RIFF = Buffer.from("RIFF");
const WEBP = Buffer.from("WEBP");
const MZ = Buffer.from([0x4d, 0x5a]);

const IMAGE_EXT: Record<string, { mime: string; exts: string[] }> = {
  jpeg: { mime: "image/jpeg", exts: ["jpg", "jpeg"] },
  png: { mime: "image/png", exts: ["png"] },
  gif: { mime: "image/gif", exts: ["gif"] },
  webp: { mime: "image/webp", exts: ["webp"] },
};

const OOXML: Record<OfficeZip, { mime: string; marker: string }> = {
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    marker: "word/",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    marker: "xl/",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    marker: "ppt/",
  },
};

const OLE_BY_EXT: Record<string, string> = {
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
};

function startsWith(buf: Buffer, sig: Buffer, offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return buf.subarray(offset, offset + sig.length).equals(sig);
}

function fileExt(originalName: string): string {
  return path.extname(originalName).toLowerCase().replace(/^\./, "");
}

function latinPreview(buf: Buffer, max = 65536): string {
  return buf.subarray(0, Math.min(buf.length, max)).toString("latin1");
}

function detectZipOffice(buf: Buffer): OfficeZip | null {
  const preview = latinPreview(buf);
  const hits: OfficeZip[] = [];
  if (preview.includes("word/")) hits.push("docx");
  if (preview.includes("xl/")) hits.push("xlsx");
  if (preview.includes("ppt/")) hits.push("pptx");
  if (hits.length === 1) return hits[0];
  return null;
}

function looksLikeHtml(buf: Buffer): boolean {
  const head = buf
    .subarray(0, Math.min(buf.length, 256))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

/**
 * Magic-byte scan — never trust client Content-Type or a lone extension.
 * Extension must still match the sniffed family (blocks .exe.pdf tricks that aren't PDF).
 */
export function sniffAttachment(buf: Buffer, originalName: string): SniffedAttachment {
  if (buf.length === 0) {
    throw new HttpError(400, "فایل خالی است", "EMPTY_FILE");
  }
  if (startsWith(buf, MZ)) {
    throw new HttpError(400, "نوع فایل مجاز نیست", "FILE_TYPE");
  }
  if (looksLikeHtml(buf)) {
    throw new HttpError(400, "نوع فایل مجاز نیست", "FILE_TYPE");
  }

  const ext = fileExt(originalName);
  if (!ext) {
    throw new HttpError(400, "پسوند فایل مشخص نیست", "FILE_TYPE");
  }

  if (startsWith(buf, PDF)) {
    if (ext !== "pdf") throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    return { mime: "application/pdf", ext: "pdf" };
  }
  if (startsWith(buf, JPEG)) {
    const spec = IMAGE_EXT.jpeg;
    if (!spec.exts.includes(ext)) {
      throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    }
    return { mime: spec.mime, ext };
  }
  if (startsWith(buf, PNG)) {
    if (ext !== "png") throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    return { mime: IMAGE_EXT.png.mime, ext: "png" };
  }
  if (startsWith(buf, GIF87) || startsWith(buf, GIF89)) {
    if (ext !== "gif") throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    return { mime: IMAGE_EXT.gif.mime, ext: "gif" };
  }
  if (startsWith(buf, RIFF) && buf.length >= 12 && startsWith(buf, WEBP, 8)) {
    if (ext !== "webp") throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    return { mime: IMAGE_EXT.webp.mime, ext: "webp" };
  }
  if (startsWith(buf, OLE)) {
    const mime = OLE_BY_EXT[ext];
    if (!mime) throw new HttpError(400, "نوع فایل آفیس قدیمی مجاز نیست یا پسوند نادرست است", "FILE_TYPE");
    return { mime, ext };
  }
  if (startsWith(buf, ZIP)) {
    const zipKind = detectZipOffice(buf);
    if (!zipKind) {
      throw new HttpError(400, "فقط فایل‌های آفیس (docx/xlsx/pptx) از نوع ZIP پذیرفته می‌شوند", "FILE_TYPE");
    }
    const spec = OOXML[zipKind];
    if (ext !== zipKind) {
      throw new HttpError(400, "پسوند با محتوای فایل هم‌خوان نیست", "FILE_TYPE");
    }
    return { mime: spec.mime, ext };
  }

  throw new HttpError(400, "نوع فایل مجاز نیست", "FILE_TYPE");
}

export function sanitizeOriginalName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();
  const cut = cleaned.slice(0, 180);
  return cut || "file";
}
