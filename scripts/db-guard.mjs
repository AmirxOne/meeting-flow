/**
 * scripts/db-guard.mjs — گارد اسکریپت‌های دیتابیبی
 *
 * اجرای destructive (migrate dev / seed / push / reset) روی دیتابیس
 * production به‌صورت تصادفی را مسدود می‌کند.
 *
 *   node scripts/db-guard.mjs migrate
 *   node scripts/db-guard.mjs seed
 *   ...
 */

import { readFileSync, existsSync } from "node:fs";

const cmd = process.argv[2] ?? "migrate";


/* همان منطق src/server/env.ts — اینجا مستقل تا بدون tsx هم کار کند */

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const base = { ...readEnvFile(".env"), ...process.env };
const mode = (base.APP_ENV ?? "").toLowerCase() === "prod" ||
             base.NODE_ENV === "production" ? "prod" : "dev";

/* seed-guard: فقط برای e2e — در production تست e2e با دیتابیس واقعی اجرا نشود */
if (cmd === "seed-guard") {
  if (mode === "prod") {
    console.error("[db-guard] e2e روی دیتابیس production ممنوع است.");
    process.exit(1);
  }
  process.exit(0);
}

const layered = {
  ...readEnvFile(".env"),
  ...readEnvFile(`.env.${mode}`),
  ...readEnvFile(".env.local"),
  ...process.env,
};

const dbUrl = layered.DATABASE_URL ?? "";
if (!dbUrl) {
  // بدون DATABASE_URL خود prisma خطای واضح می‌دهد — بگذ بگذرد
  process.exit(0);
}

const PROD_MARKERS = [
  /:\/\/[^@]*@prod[-.]/i,
  /\.database\.azure\.com/i,
  /\.rds\.amazonaws\.com/i,
  /\.cloud\.sql\./i,
];

const isProdUrl = PROD_MARKERS.some((re) => re.test(dbUrl));
const looksProd = mode === "prod" || isProdUrl;

if (!looksProd) process.exit(0);

if (process.env.CONFIRM_PROD_DB === "yes") {
  console.warn(`[!] ${cmd} روی دیتابیس production اجرا شد (CONFIRM_PROD_DB=yes)`);
  process.exit(0);
}

console.error(
  `\n[x] دستور «${cmd}» در حالت ${mode} به دیتابیس production اشاره می‌کند و اجرا نشد.` +
  `\n    DATABASE_URL: ${dbUrl.replace(/:[^:@/]+@/, ":***@")}` +
  `\n    اگر عمدی است: CONFIRM_PROD_DB=yes pnpm ${cmd === "migrate" ? "db:deploy" : cmd}` +
  `\n    برای migrate عمدیِ prod همیشه از «pnpm db:deploy» استفاده کن.\n`,
);
process.exit(1);
