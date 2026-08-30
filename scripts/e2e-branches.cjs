// E2E: branches page — floor CRUD (UI add/delete + API edit verify)
const { BASE, ALL_TOURS, markToursSeenScript, login, dismissTour, safeClick, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);
  const uniq = String(Date.now()).slice(-6);
  const floorName = `طبقه E2E ${uniq}`;
  const floorRenamed = `طبقه ویرایش ${uniq}`;
  const floorNumber = 50 + (Date.now() % 50);
  let floorId = null;

  const { userId } = await login(page, "admin@example.com");

  const pre = await page.request.get(`${BASE}/api/branches`);
  const preNiavaran = ((await pre.json())?.data?.branches ?? []).find((b) => b.id === "branch-niavaran");
  for (const f of preNiavaran?.floors ?? []) {
    if (f.name.includes("E2E") || f.name.includes("ویرایش")) {
      await page.request.delete(`${BASE}/api/branches/branch-niavaran/floors/${f.id}`);
    }
  }

  await page.evaluate(markToursSeenScript, { uid: userId, tours: ALL_TOURS });
  await Promise.all([
    page.goto(`${BASE}/branches`, { waitUntil: "domcontentloaded" }),
    page.waitForResponse((r) => r.url().includes("/api/branches") && r.status() === 200, { timeout: 45000 }),
  ]);
  await page.waitForTimeout(1500);
  await dismissTour(page);

  const branchesApi = await page.request.get(`${BASE}/api/branches`);
  check("api canManage", (await branchesApi.json())?.data?.canManage === true);

  await page.locator("h1:has-text('شعب')").waitFor({ timeout: 30000 });
  const manageBtns = await page.locator('button[aria-label="مدیریت طبقات"]').count();
  check(`branches manage UI (${manageBtns} floor buttons)`, manageBtns >= 2);

  const card = page.locator("div.rounded-md.border.border-line", { hasText: "شعبه نیاوران" }).first();
  await safeClick(page, card.locator('button[aria-label="مدیریت طبقات"]'));

  const dlg = page.getByRole("dialog", { name: /طبقات/ });
  await dlg.waitFor({ timeout: 15000 });
  check("floors modal opens", true);

  await dlg.locator('input[placeholder="نام طبقه *"]').fill(floorName);
  await dlg.locator('input[placeholder="شماره طبقه *"]').fill(String(floorNumber));
  await dlg.locator('button:has-text("افزودن طبقه")').click({ force: true });
  await page.locator("text=طبقه اضافه شد").waitFor({ timeout: 20000 });

  const branchesAfterAdd = await page.request.get(`${BASE}/api/branches`);
  const niavaran = ((await branchesAfterAdd.json())?.data?.branches ?? []).find((b) => b.id === "branch-niavaran");
  floorId = niavaran?.floors?.find((f) => f.name === floorName)?.id;
  check(`floor added via UI (${floorId ?? "missing"})`, !!floorId);

  const patchRes = await page.request.patch(`${BASE}/api/branches/branch-niavaran/floors/${floorId}`, {
    headers: { "Content-Type": "application/json" },
    data: { name: floorRenamed },
  });
  check(`floor renamed via API (${patchRes.status()})`, patchRes.status() === 200);
  const afterPatch = await page.request.get(`${BASE}/api/branches`);
  const renamedInApi = ((await afterPatch.json())?.data?.branches ?? [])
    .find((b) => b.id === "branch-niavaran")?.floors?.some((f) => f.name === floorRenamed);
  check("renamed floor in API", !!renamedInApi);

  await dlg.locator('button[aria-label="بستن"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await dismissTour(page);

  await safeClick(page, card.locator('button[aria-label="مدیریت طبقات"]'));
  await dlg.waitFor({ timeout: 15000 });
  check("renamed floor visible in modal after reload", (await dlg.getByText(floorRenamed).count()) >= 1);
  check("floor delete buttons in modal", (await dlg.locator('button[aria-label="حذف طبقه"]').count()) >= 1);

  const delRes = await page.request.delete(`${BASE}/api/branches/branch-niavaran/floors/${floorId}`);
  check(`floor deleted (${delRes.status()})`, delRes.status() === 200);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await dismissTour(page);
  await safeClick(page, card.locator('button[aria-label="مدیریت طبقات"]'));
  await dlg.waitFor({ timeout: 15000 });
  check("deleted floor absent from modal", (await dlg.getByText(floorRenamed).count()) === 0);

  await dlg.locator('button[aria-label="بستن"]').click();
  await page.waitForTimeout(300);
  check("floors modal closed", (await page.getByRole("dialog", { name: /طبقات/ }).count()) === 0);

  await finish(results, browser);
})();
