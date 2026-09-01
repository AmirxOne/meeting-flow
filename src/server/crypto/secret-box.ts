import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function secretKey(): Buffer {
  return createHash("sha256")
    .update(process.env.SESSION_SECRET ?? "dev")
    .digest();
}

/** Encrypt a secret with AES-256-GCM. Returns iv.tag.ciphertext (hex). */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

/** Decrypt a value produced by sealSecret. */
export function openSecret(packed: string): string {
  const [ivHex, tagHex, dataHex] = packed.split(".");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("invalid sealed secret");
  }
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
