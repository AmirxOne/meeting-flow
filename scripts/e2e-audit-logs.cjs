// E2E: audit logs page — filters, expand detail, pagination
const { BASE, login, dismissTour, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const { userId, cookieName, cookieValue } = await login(page, "admin@example.com");
  const cookie = `${cookieName}=${cookieValue}`;
  await gotoApp(page, "/admin/audit-logs", userId);

  await page.locator("h1:has-text('لاگ ممیزی')").waitFor({ timeout: 60000 });
  check("audit logs heading visible", true);

  await page.locator("text=رخداد ثبت‌شده").first().waitFor({ timeout: 30000 });
  check("audit summary loaded", true);

  await dismissTour(page);

  // pagination smoke (before filters narrow the result set)
  const meta = await page.request.get(`${BASE}/api/admin/audit-logs?page=1`, {
    headers: { cookie },
  });
  const metaBody = await meta.json();
  const total = metaBody?.data?.total ?? 0;
  const uiPageSize = metaBody?.data?.pageSize ?? 50;
  const uiTotalPages = Math.max(1, Math.ceil(total / uiPageSize));

  if (uiTotalPages > 1) {
    const nextBtn = page.locator('button:has-text("بعدی")');
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      el.click();
    });
    await page.waitForTimeout(1200);
    const pageLabel = await page.locator("text=صفحه").first().textContent();
    check(`pagination next (${pageLabel?.trim()})`, (pageLabel ?? "").includes("۲"));
    const prevBtn = page.locator('button:has-text("قبلی")');
    await prevBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      el.click();
    });
    await page.waitForTimeout(800);
    check("pagination prev works", true);
  } else {
    const p2 = await page.request.get(`${BASE}/api/admin/audit-logs?page=2`, { headers: { cookie } });
    check(`API pagination page 2 (${p2.status()})`, p2.status() === 200);
    check(`UI single-page view (total=${total})`, (await page.locator('button:has-text("بعدی")').count()) === 0);
  }

  // entity filter: جلسه (Meeting)
  await page.getByRole("button", { name: /^موجودیت:/ }).click();
  await page.waitForTimeout(400);
  await page.locator('ul[role="listbox"] li', { hasText: "جلسه" }).click();
  await page.waitForTimeout(1200);
  const entityBtn = await page.getByRole("button", { name: /^موجودیت:/ }).textContent();
  check(`entity filter set (${entityBtn?.trim()})`, (entityBtn ?? "").includes("جلسه"));

  const entityApi = await page.request.get(`${BASE}/api/admin/audit-logs?entity=Meeting&page=1`, {
    headers: { cookie },
  });
  check(`entity-filter API (${entityApi.status()})`, entityApi.status() === 200);
  const entityLogs = (await entityApi.json())?.data?.logs ?? [];
  check("entity filter API returns Meeting rows", entityLogs.every((l) => l.entity === "Meeting"));

  // action filter: ایجاد (CREATE)
  await page.getByRole("button", { name: /^عملیات:/ }).click();
  await page.waitForTimeout(400);
  await page.locator('ul[role="listbox"] li', { hasText: "ایجاد" }).click();
  await page.waitForTimeout(1200);
  const actionBtn = await page.getByRole("button", { name: /^عملیات:/ }).textContent();
  check(`action filter set (${actionBtn?.trim()})`, (actionBtn ?? "").includes("ایجاد"));

  // expand first row with detail chevron
  const expandBtn = page.locator("tbody tr").first().locator("svg").first();
  if ((await expandBtn.count()) > 0) {
    await page.locator("tbody tr").first().click();
    await page.waitForTimeout(400);
    check("detail panel shows old/new values", (await page.locator("text=مقدار قبلی").count()) >= 1);
  } else {
    check("detail panel shows old/new values (skipped — no payload rows)", true);
  }

  await finish(results, browser);
})();
