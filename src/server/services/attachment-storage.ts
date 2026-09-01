import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk blob store. Swap the internals for S3 later; callers only use
 * storageKey (relative, never a user-supplied path).
 */
export function attachmentsRootDir(): string {
  const raw = process.env.MEETING_ATTACHMENTS_DIR?.trim() || "./data/attachments";
  return path.resolve(process.cwd(), raw);
}

function assertSafeKey(storageKey: string): void {
  if (!storageKey || storageKey.includes("\0")) {
    throw new Error("invalid storage key");
  }
  const normalized = storageKey.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("..") || path.isAbsolute(storageKey)) {
    throw new Error("invalid storage key");
  }
}

export function resolveStoragePath(storageKey: string): string {
  assertSafeKey(storageKey);
  const root = attachmentsRootDir();
  const abs = path.resolve(root, storageKey);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("invalid storage key");
  }
  return abs;
}

export async function writeAttachment(storageKey: string, buf: Buffer): Promise<void> {
  const abs = resolveStoragePath(storageKey);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
}

export async function readAttachmentBuffer(storageKey: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storageKey));
}

export async function removeAttachmentFile(storageKey: string): Promise<void> {
  try {
    await unlink(resolveStoragePath(storageKey));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
}
