// E2E: branches page — floor CRUD purely via UI (add → edit → delete)
const { BASE, login, dismissTour, safeClick, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

async function cleanupE2EFloors(page) {
  const res = await page.request.get(`${BASE}/api/branches`);
  const niavaran = ((await res.json())?.data?.branches ?? []).find((b) => b.id === "branch-niavaran");
  for (const f of niavaran?.floors ?? []) {
    if (/E2E|ویرایش/.test(f.name)) {
      await page.request
        .delete(`${BASE}/api/branches/branch-niavaran/floors/${f.id}`)
        .catch(() => {});
    }
  }
}

async function openNiavaranFloorsModal(page) {
  const card = page.locator("div.rounded-md.border.border-line", { hasText: "شعبه نیاوران" }).first();
  await card.waitFor({ state: "visible", timeout: 30000 });
  await safeClick(page, card.locator('button[aria-label="مدیریت طبقات"]'));
  const dlg = page.getByRole("dialog", { name: /طبقات شعبه نیاوران/ });
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('[data-testid="floor-name-input"]').waitFor({ timeout: 15000 });
  return { card, dlg };
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept());

  const results = [];
  const check = (n, c) => results.push([n, !!c]);
  const uniq = String(Date.now()).slice(-6);
  const floorName = `طبقه E2E ${uniq}`;
  const floorRenamed = `طبقه ویرایش ${uniq}`;
  const floorNumber = 50 + (Date.now() % 50);

  try {
    const { userId } = await login(page, "admin@example.com");
    await cleanupE2EFloors(page);

    await gotoApp(page, "/branches", userId);
    await page.locator("text=شعبه نیاوران").waitFor({ timeout: 30000 });

    const branchesApi = await page.request.get(`${BASE}/api/branches`);
    check("api canManage", (await branchesApi.json())?.data?.canManage === true);

    await page.locator("h1:has-text('شعب')").waitFor({ timeout: 30000 });
    await page.locator('button[aria-label="مدیریت طبقات"]').first().waitFor({ state: "visible", timeout: 30000 });
    const manageBtns = await page.locator('button[aria-label="مدیریت طبقات"]').count();
    check(`branches manage UI (${manageBtns} floor buttons)`, manageBtns >= 2);

    let { dlg } = await openNiavaranFloorsModal(page);
    check("floors modal opens", true);

    await dlg.locator('[data-testid="floor-name-input"]').fill(floorName);
    await dlg.locator('[data-testid="floor-number-input"]').fill(String(floorNumber));
    const addBtn = dlg.locator('[data-testid="floor-save-btn"]');
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await expectEnabled(addBtn);
    await safeClick(page, addBtn);
    await page.locator("text=طبقه اضافه شد").waitFor({ timeout: 20000 });
    await dlg.locator(`[data-testid="floor-row"]:has-text("${floorName}")`).waitFor({ timeout: 15000 });
    check(`floor added in modal (${floorName})`, true);

    const row = dlg.locator(`[data-testid="floor-row"]:has-text("${floorName}")`);
    await safeClick(page, row.locator('button[aria-label="ویرایش طبقه"]'));
    await dlg.locator('[data-testid="floor-save-btn"]:has-text("ذخیره")').waitFor({ timeout: 10000 });

    await dlg.locator('[data-testid="floor-name-input"]').fill(floorRenamed);
    await safeClick(page, dlg.locator('[data-testid="floor-save-btn"]:has-text("ذخیره")'));
    await page.locator("text=طبقه ویرایش شد").waitFor({ timeout: 20000 });
    await dlg.locator(`[data-testid="floor-row"]:has-text("${floorRenamed}")`).waitFor({ timeout: 15000 });
    check(`floor renamed in modal (${floorRenamed})`, (await dlg.getByText(floorName).count()) === 0);

    const renamedRow = dlg.locator(`[data-testid="floor-row"]:has-text("${floorRenamed}")`);
    check("floor delete button visible", (await renamedRow.locator('button[aria-label="حذف طبقه"]').count()) >= 1);

    await safeClick(page, renamedRow.locator('button[aria-label="حذف طبقه"]'));
    await page.locator("text=طبقه حذف شد").waitFor({ timeout: 20000 });
    await page.waitForTimeout(400);
    check("deleted floor absent from modal", (await dlg.getByText(floorRenamed).count()) === 0);

    await safeClick(page, dlg.locator('button:has-text("بستن")'));
    await page.waitForTimeout(400);
    check("floors modal closed", (await page.getByRole("dialog", { name: /طبقات/ }).count()) === 0);
  } catch (e) {
    console.error(e);
    check("unexpected error", false);
  } finally {
    await cleanupE2EFloors(page);
  }

  await finish(results, browser);
})();

async function expectEnabled(locator) {
  for (let i = 0; i < 20; i++) {
    if (await locator.isEnabled()) return;
    await locator.page().waitForTimeout(200);
  }
  throw new Error("button stayed disabled");
}
