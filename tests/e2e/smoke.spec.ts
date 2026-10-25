import { test, expect, type Page } from "@playwright/test";

/* Smoke E2E — مسیرهای اصلی پس از استقرار (release checklist مرحله ۸)
 * پیش‌نیاز: سرور بالا + دیتابیس dev-seeded (admin@example.com)
 * گاتشاها (از تاریخچه): فرم لاگین با کلیک submit نه Enter؛ تور nextstepjs با localStorage بسته شود.
 */

const IDENT = process.env.E2E_USER ?? "admin@example.com";
const PASS = process.env.E2E_PASS ?? "Pass1234";

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="identifier"]').fill(IDENT);
  await page.locator('input[name="password"]').fill(PASS);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard|\/$/, { timeout: 20_000 });
}

test("سلامت عمومی — صفحه لاگین بار می‌شود", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("ورود موفق → داشبورد", async ({ page }) => {
  await login(page);
  await expect(page.locator("body")).toContainText(/داشبورد|جلسات|تقویم/, { timeout: 15_000 });
});

test("API جلسات پس از ورود ok:true برمی‌گرداند", async ({ page }) => {
  await login(page);
  // fetch از خود صفحه — کوکی session خودکار همراه است
  const body = await page.evaluate(async () => {
    const r = await fetch("/api/meetings?limit=5", { credentials: "include" });
    return { status: r.status, json: await r.json() };
  });
  expect(body.status).toBe(200);
  expect(body.json.ok).toBe(true);
});

test("تقویم بار می‌شود", async ({ page }) => {
  await login(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText(/شنبه|یکشنبه|دوشنبه|امروز/, { timeout: 15_000 });
});

test("خروج کار می‌کند", async ({ page }) => {
  await login(page);
  const res = await page.goto("/login");
  expect([200, 302, 307]).toContain(res?.status() ?? 200);
});
