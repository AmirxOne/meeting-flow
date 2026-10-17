/**
 * ─────────────────────────────────────────────────────────────
 *  Environment loader — تک‌منبع حقیقت تنظیمات محیطی پروژه
 * ─────────────────────────────────────────────────────────────
 *
 *  لایه‌ها (به ترتیب اولویت — اولی برنده):
 *    1. process.env  (سیستم/CI/compose — همیشه بالاترین اولویت)
 *    2. .env.local   (اسرار شخصی همین ماشین — git-ignored)
 *    3. .env.<mode>  (dev | prod — انتخاب با APP_ENV)
 *    4. .env         (پایه/مشترک)
 *
 *  انتخاب حالت:
 *    APP_ENV=dev | prod   (متغیر یا در فایل .env)
 *    پیش‌فرض: dev در `next dev`/worker:dev، prod در بیلد standalone.
 *
 *  قانون‌ها:
 *    - در prod نبود SESSION_SECRET یا DATABASE_URL → crash فوری (fail-fast).
 *    - NODE_ENV از حالت مشتق می‌شود (dev→development، prod→production).
 *    - اعتبارسنجی Zod: مقدار غلط = پیام فارسی دقیق، نه رفتار عجیب در runtime.
 */

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/* ─── تشخیص حالت ─── */

export type EnvMode = "dev" | "prod";

function detectMode(): EnvMode {
  const raw = (process.env.APP_ENV ?? "").trim().toLowerCase();
  if (raw === "dev" || raw === "prod") return raw;
  // NODE_ENV=production و APP_ENV نگفته → prod
  if (process.env.NODE_ENV === "production") return "prod";
  return "dev";
}

/* ─── بارگذاری فایل‌ها به‌ترتیب لایه (اول بارگیری، اولویت با دومی‌ها) ───
 * dotenv مقادیر موجود در process.env را override نمی‌کند،
 * پس ترتیب فراخوانی: پایه → mode → local  (local بیشترین برتری فایلی).
 */

const mode = detectMode();

loadDotenv({ path: ".env" }); // پایه — مشترک
loadDotenv({ path: `.env.${mode}` }); // اختصاصی حالت
loadDotenv({ path: ".env.local", override: true }); // اسرار ماشین — بر همه‌ی فایل‌ها اولویت دارد

export const ENV_MODE = mode;

/* ─── اسکیمای اعتبارسنجی ─── */

const boolish = z
  .string()
  .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase()));

const port = z
  .string()
  .regex(/^\d{1,5}$/, "PORT باید عدد باشد")
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

const url = z.string().url();

const envSchema = z.object({
  /* هسته */
  NODE_ENV: z.enum(["development", "test", "production"]).default(mode === "prod" ? "production" : "development"),
  APP_ENV: z.enum(["dev", "prod"]).default(mode),
  APP_URL: url.default("http://localhost:3100"),
  APP_PORT: port.default("3100"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL تنظیم نشده است"),
  REDIS_URL: z.string().min(1, "REDIS_URL تنظیم نشده است").default("redis://localhost:6379"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET باید حداقل ۱۶ نویسه باشد"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).default(24 * 14),
  DISPLAY_TIMEZONE: z.string().default("Asia/Tehran"),
  HTTPS: boolish.default("false"),

  /* احراز هویت */
  AUTH_MODE: z.string().default("local"),

  /* worker */
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
  WORKER_STALE_MINUTES: z.coerce.number().int().min(1).default(30),
  WORKER_HEALTH_PORT: port.default("3101"),
  WORKER_TICK_SECRET: z.string().optional(),

  /* اعلان‌ها */
  NOTIFICATION_SMS_PROVIDER: z.enum(["mock", "kavenegar", "smsir"]).default("mock"),
  NOTIFICATION_EMAIL_PROVIDER: z.enum(["mock", "smtp"]).default("mock"),
  REMINDER_CHANNELS: z.string().default("IN_APP"),
  SMS_FROM: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: port.optional(),
  SMTP_SECURE: boolish.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  /* پیوست‌ها */
  MEETING_ATTACHMENTS_DIR: z.string().default("./data/attachments"),
  MEETING_ATTACHMENTS_MAX_BYTES: z.coerce.number().int().min(1).default(25 * 1024 * 1024),

  /* پوش */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

/* ─── اعتبارسنجی + fail-fast ─── */

function parseEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(
      `\n[x] خطای تنظیمات محیط (حالت: ${mode})\n` +
      `    فایل‌های بررسی‌شده: .env → .env.${mode} → .env.local\n${issues}\n`,
    );
    throw new Error(`ENV_VALIDATION_FAILED (${result.error.issues.length} issue)`);
  }
  return result.data;
}

/** فقط در prod به‌سختی fail می‌کنیم؛ در dev هم fail می‌کنیم چون بدون این‌ها اپ بی‌معناست. */
export const env = parseEnv();

/* NODE_ENV را بازنویسی نمی‌کنیم — Next آن را ست می‌کند و minifier با
   assignment به property فرست‌شده در production مشکل دارد («Assigning to rvalue»).
   parseEnv مقدار schema (default) را فقط برای مصرف داخلی برمی‌گرداند. */

/* ─── گارد دیتابیس — جلوگیری از دست‌کاری تصادفی دیتابیس اشتباه ─── */

const PROD_DB_MARKERS = [
  /:\/\/[^@]*@prod[-.]/i,
  /prod(?:uction)?\.postgres\.azure\.com/i,
  /\.database\.azure\.com/i,
  /\.rds\.amazonaws\.com/i,
  /\.cloud\.sql\./i,
];

/**
 * اگر دستور مخرب (migrate/seed/push/drop) در حالت dev، به دیتابیس production اشاره کند → خطا.
 * قطع کلید: CONFIRM_PROD_DB=yes (عمدی، پای دردسر).
 */
export function guardDestructiveDbCommand(cmd: "migrate" | "seed" | "push" | "reset"): void {
  const dbUrl = env.DATABASE_URL;
  const isProdUrl = PROD_DB_MARKERS.some((re) => re.test(dbUrl));
  const looksProd = ENV_MODE === "prod" || isProdUrl;

  if (!looksProd) return;

  if (process.env.CONFIRM_PROD_DB === "yes") {
    // eslint-disable-next-line no-console
    console.warn(`[!] ${cmd} روی دیتابیس production اجرا شد (CONFIRM_PROD_DB=yes)`);
    return;
  }
  // eslint-disable-next-line no-console
  console.error(
    `\n[x] دستور «${cmd}» به دیتابیس production اشاره می‌کند و اجرا نشد.\n` +
    `    DATABASE_URL: ${dbUrl.replace(/:[^:@/]+@/, ":***@")}\n` +
    `    اگر عمدی است: CONFIRM_PROD_DB=yes pnpm db:${cmd === "migrate" ? "deploy" : cmd}\n`,
  );
  process.exit(1);
}
