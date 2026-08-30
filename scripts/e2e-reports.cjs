// E2E: reports page — date range filter + CSV export smoke
const { BASE, login, dismissTour, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const { userId } = await login(page, "admin@example.com");
  await gotoApp(page, "/reports", userId);

  await page.locator("h1:has-text('گزارش‌ها')").waitFor({ timeout: 60000 });
  check("reports heading visible", true);

  await page.locator("text=کل جلسات").first().waitFor({ timeout: 30000 });
  const metricText = await page.locator("text=کل جلسات").first().locator("..").textContent();
  check(`summary metric loaded (${metricText?.trim().slice(0, 40)})`, /[\u06F0-\u06F9]/.test(metricText ?? ""));

  // range preset: ۷ روز
  await dismissTour(page);
  await page.locator('button[aria-haspopup="listbox"]', { hasText: "بازه" }).click();
  await page.waitForTimeout(400);
  await page.locator('ul[role="listbox"] li', { hasText: "۷ روز" }).click();
  await page.waitForTimeout(1500);
  const rangeBtn = await page.locator('button[aria-haspopup="listbox"]', { hasText: "بازه" }).textContent();
  check(`range filter set to 7 days (${rangeBtn?.trim()})`, (rangeBtn ?? "").includes("۷ روز"));

  await page.locator("text=کل جلسات").first().waitFor({ timeout: 30000 });
  check("metrics refresh after range change", (await page.locator(".skeleton").count()) === 0);

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const csvRes = await page.request.get(`${BASE}/api/reports?from=${from}&to=${to}&format=csv`);
  const csvBody = await csvRes.text();
  check(`CSV download (${csvRes.status()})`, csvRes.status() === 200);
  check("CSV has header row", csvBody.includes("id,title,status,type,branch,room"));
  check("CSV export button visible", (await page.locator('button:has-text("خروجی CSV")').count()) === 1);

  await finish(results, browser);
})();
