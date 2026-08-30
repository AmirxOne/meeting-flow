// E2E: admin policies — toggle a boolean policy
const { BASE, login, dismissTour, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);
  const POLICY_KEY = "autoApproveInternal";
  const POLICY_LABEL = "جلسه داخلی خودکار تأیید شود";

  const { userId } = await login(page, "admin@example.com");

  const beforeRes = await page.request.get(`${BASE}/api/admin/policies`);
  const beforePolicies = (await beforeRes.json())?.data?.policies ?? [];
  const before = beforePolicies.find((p) => p.key === POLICY_KEY)?.value;
  check(`setup: read policy (${beforeRes.status()}, value=${before})`, beforeRes.status() === 200 && typeof before === "boolean");

  await gotoApp(page, "/admin/policies", userId);
  await page.locator("text=سیاست‌های جلسه").first().waitFor({ timeout: 30000 });
  check("policies heading visible", (await page.locator("h1:has-text('سیاست‌های جلسه')").count()) === 1);

  const row = page.locator("div.flex.items-center.justify-between", { hasText: POLICY_LABEL }).first();
  await row.waitFor({ timeout: 15000 });
  const toggle = row.locator('button[aria-label="تغییر"]');
  check("bool policy toggle present", (await toggle.count()) === 1);

  await dismissTour(page);
  await toggle.click();
  await page.waitForTimeout(1500);
  const toast = await page.locator("text=سیاست ذخیره شد").count();
  check("save toast after toggle", toast >= 1);

  const afterRes = await page.request.get(`${BASE}/api/admin/policies`);
  const afterPolicies = (await afterRes.json())?.data?.policies ?? [];
  const after = afterPolicies.find((p) => p.key === POLICY_KEY)?.value;
  check(`policy flipped via API (${before} → ${after})`, after === !before);

  // restore seed default (autoApproveInternal: true)
  await page.request.patch(`${BASE}/api/admin/policies`, {
    headers: { "Content-Type": "application/json" },
    data: { key: POLICY_KEY, value: true },
  });
  const restoredRes = await page.request.get(`${BASE}/api/admin/policies`);
  const restored = ((await restoredRes.json())?.data?.policies ?? []).find((p) => p.key === POLICY_KEY)?.value;
  check(`policy restored to seed (${restored})`, restored === true);

  // defaultReminderOffsets — add then remove, restore seed [30, 10]
  const OFFSET_KEY = "defaultReminderOffsets";
  const SEED_OFFSETS = [30, 10];
  const beforeOffsets = beforePolicies.find((p) => p.key === OFFSET_KEY)?.value ?? SEED_OFFSETS;

  await page.locator('[data-testid="reminder-offset-add"]').click();
  await page.waitForTimeout(600);
  const rows = page.locator('[data-testid="reminder-offset-row"] input');
  const lastInput = rows.last();
  await lastInput.fill("60");
  await lastInput.blur();
  await page.waitForTimeout(1500);
  check("offset save toast", (await page.locator("text=سیاست ذخیره شد").count()) >= 1);

  const afterOffsetsRes = await page.request.get(`${BASE}/api/admin/policies`);
  const afterOffsets = ((await afterOffsetsRes.json())?.data?.policies ?? []).find((p) => p.key === OFFSET_KEY)?.value;
  check(`offset added via API (${JSON.stringify(afterOffsets)})`, Array.isArray(afterOffsets) && afterOffsets.includes(60));

  await page.locator('[data-testid="reminder-offset-row"]').first().locator('button[aria-label="حذف یادآور"]').click();
  await page.waitForTimeout(1500);
  const removedRes = await page.request.get(`${BASE}/api/admin/policies`);
  const removedOffsets = ((await removedRes.json())?.data?.policies ?? []).find((p) => p.key === OFFSET_KEY)?.value;
  check(`offset removed (${JSON.stringify(removedOffsets)})`, !Array.isArray(removedOffsets) || !removedOffsets.includes(60));

  await page.request.patch(`${BASE}/api/admin/policies`, {
    headers: { "Content-Type": "application/json" },
    data: { key: OFFSET_KEY, value: beforeOffsets.length ? beforeOffsets : SEED_OFFSETS },
  });
  const restoredOffsets = ((await (await page.request.get(`${BASE}/api/admin/policies`)).json())?.data?.policies ?? [])
    .find((p) => p.key === OFFSET_KEY)?.value;
  check(`offsets restored (${JSON.stringify(restoredOffsets)})`, JSON.stringify(restoredOffsets) === JSON.stringify(beforeOffsets.length ? beforeOffsets : SEED_OFFSETS));

  const empPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const { userId: empId } = await login(empPage, "ali@example.com");
  await gotoApp(empPage, "/admin/policies", empId);
  check(
    "employee policies page guard UI",
    (await empPage.locator("text=policy:manage").count()) > 0
      && (await empPage.locator("text=سیاست‌های جلسه").count()) === 0,
  );
  await empPage.close();

  await finish(results, browser);
})();
