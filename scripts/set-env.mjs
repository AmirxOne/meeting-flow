#!/usr/bin/env node
/**
 * scripts/set-env.mjs — سوییچ حالت محیط
 *
 *   node scripts/set-env.mjs dev
 *   node scripts/set-env.mjs prod
 *
 * فقط خط APP_ENV در .env را عوض می‌کند (فایل اگر نبود می‌سازد).
 * بقیه‌ی لایه‌ها دست نمی‌خورند: .env.dev / .env.prod / .env.local
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "prod") {
  console.error("استفاده: node scripts/set-env.mjs <dev|prod>");
  process.exit(1);
}

const HEADER =
  "# ─── سوییچ حالت ───\n" +
  "# dev = توسعه | prod = استقرار واقعی\n" +
  "# بقیه‌ی تنظیمات: .env.dev / .env.prod / .env.local (اسرار شخصی، override)\n";

let body = "";
if (existsSync(".env")) {
  body = readFileSync(".env", "utf8");
}

// خطوط بدون APP_ENV را نگه دار؛ فقط سوییچ عوض شود
const kept = body
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("APP_ENV="))
  .join("\n");

writeFileSync(".env", `${HEADER}APP_ENV=${mode}\n${kept ? kept + "\n" : ""}`);

console.log(`[ok] APP_ENV=${mode}`);
if (mode === "prod" && !existsSync(".env.prod")) {
  console.warn("[!] .env.prod وجود ندارد — از نمونه کپی کن: cp .env.prod.example .env.prod");
}
