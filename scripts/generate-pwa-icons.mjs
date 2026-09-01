/**
 * Generate PWA PNG icons (no extra deps — zlib + raw PNG).
 * Dark #0d0d0d tile with a white rounded mark (Mehrsa shell).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, paint) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4;
      const [r, g, b, a] = paint(x, y, size);
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, l, t, r, b, radius) {
  if (x < l || x > r || y < t || y > b) return false;
  const cx = x < l + radius ? l + radius : x > r - radius ? r - radius : x;
  const cy = y < t + radius ? t + radius : y > b - radius ? b - radius : y;
  if (cx === x || cy === y) return true;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function paintMark(insetRatio) {
  return (x, y, size) => {
    const inset = size * insetRatio;
    const l = inset;
    const t = inset;
    const r = size - 1 - inset;
    const b = size - 1 - inset;
    const radius = (r - l) * 0.18;
    const innerPad = (r - l) * 0.22;
    const il = l + innerPad;
    const it = t + innerPad;
    const ir = r - innerPad;
    const ib = b - innerPad;
    const irad = (ir - il) * 0.16;
    if (inRoundedRect(x, y, il, it, ir, ib, irad)) return [255, 255, 255, 255];
    if (inRoundedRect(x, y, l, t, r, b, radius)) return [13, 13, 13, 255];
    return [13, 13, 13, 255];
  };
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public/icons");
mkdirSync(dir, { recursive: true });

const files = [
  ["icon-192.png", 192, 0.12],
  ["icon-512.png", 512, 0.12],
  ["icon-maskable-192.png", 192, 0.22],
  ["icon-maskable-512.png", 512, 0.22],
  ["apple-touch-icon.png", 180, 0.14],
];

for (const [name, size, inset] of files) {
  writeFileSync(join(dir, name), png(size, paintMark(inset)));
}

writeFileSync(join(root, "public/apple-touch-icon.png"), png(180, paintMark(0.14)));
console.log(`[pwa] wrote ${files.length + 1} icons`);
