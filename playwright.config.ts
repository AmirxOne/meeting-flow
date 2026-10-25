import { defineConfig } from "@playwright/test";

// E2E رسمی — روی سرور در حال اجرا (پیش‌فرض: prod build روی 3100)
// اجرا: pnpm test:e2e   (سرور باید از قبل بالا باشد: pnpm start)
// یا با dev:  E2E_BASE_URL=http://localhost:3100 pnpm test:e2e
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // تست‌ها state مشترک دارند — سریالی
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    timezoneId: "Asia/Tehran",
    locale: "fa-IR",
    headless: true,
    channel: "chrome", // Chrome سیستمی — طبق قرارداد پروژه
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
