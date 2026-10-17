import { config as loadDotenv } from "dotenv";
import type { PrismaConfig } from "prisma";

/**
 * prisma.config.ts — پرچم‌دهی لایه‌ای env به Prisma CLI
 * (از Prisma 7 جایگزین package.json#prisma است؛ از الان مهاجرت کردیم)
 *
 * همان ترتیب src/server/env.ts:
 *   .env → .env.<APP_ENV> → .env.local → process.env
 */

const mode = (() => {
  // اول .env پایه را بخوان تا APP_ENV معلوم شود
  loadDotenv({ path: ".env" });
  const raw = (process.env.APP_ENV ?? "").trim().toLowerCase();
  if (raw === "dev" || raw === "prod") return raw;
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
})();

loadDotenv({ path: `.env.${mode}` });
loadDotenv({ path: ".env.local", override: true });

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
} satisfies PrismaConfig;
