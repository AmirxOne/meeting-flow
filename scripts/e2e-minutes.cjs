// E2E: organizer records minutes after COMPLETED; body visible on meeting detail
const { launchBrowser, login, gotoApp, finish, BASE, safeClick } = require("./e2e-lib.cjs");

const RUN = Math.floor(Date.now() / 60000);
const BODY = `جمع‌بندی E2E صورتجلسه ${RUN}`;
const DECISION = `تصمیم پیگیری ${RUN}`;

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  let meetingId = "";
  let cookie = "";

  try {
    const auth = await login(page, "ali@example.com");
    cookie = `${auth.cookieName}=${auth.cookieValue}`;

    const start = new Date(Date.now() + (12 + (RUN % 7)) * 86400000);
    start.setUTCHours(8, RUN % 40, 0, 0);
    const end = new Date(start.getTime() + 45 * 60000);
    const created = await page.request.post(`${BASE}/api/meetings`, {
      headers: { "Content-Type": "application/json", Cookie: cookie },
      data: {
        title: `E2E صورتجلسه ${RUN}`,
        branchId: "branch-niavaran",
        roomId: "room-a",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        meetingType: "INTERNAL",
      },
    });
    const body = await created.json();
    meetingId = body?.data?.meeting?.id ?? "";
    check("create meeting for minutes", created.status() === 201 && !!meetingId);

    if (meetingId) {
      const started = await page.request.post(`${BASE}/api/meetings/${meetingId}/start`, {
        headers: { Cookie: cookie },
      });
      check("start meeting", started.status() === 200);
      const ended = await page.request.post(`${BASE}/api/meetings/${meetingId}/end`, {
        headers: { "Content-Type": "application/json", Cookie: cookie },
        data: { noShow: false },
      });
      check("end meeting", ended.status() === 200);
    }

    await gotoApp(page, `/meetings/${meetingId}`, auth.userId);
    await page.waitForSelector('[data-testid="meeting-minutes"]', { timeout: 20000 });
    check("minutes card visible", (await page.locator('[data-testid="meeting-minutes"]').count()) > 0);
    check("edit button for organizer", (await page.locator('[data-testid="minutes-edit-btn"]').count()) > 0);

    await safeClick(page, page.locator('[data-testid="minutes-edit-btn"]'));
    await page.waitForSelector('[data-testid="minutes-body-input"]', { timeout: 10000 });
    await page.locator('[data-testid="minutes-body-input"]').fill(BODY);
    await safeClick(page, page.locator('[data-testid="minutes-add-decision"]'));
    await page.waitForSelector('[data-testid="minutes-decision-text"]', { timeout: 5000 });
    await page.locator('[data-testid="minutes-decision-text"]').fill(DECISION);
    await safeClick(page, page.locator('[data-testid="minutes-save-btn"]'));

    await page.waitForSelector('[data-testid="minutes-body-view"]', { timeout: 15000 });
    const viewText = await page.locator('[data-testid="minutes-body-view"]').textContent();
    check("minutes body shown", (viewText ?? "").includes(BODY));
    const decisionText = await page.locator('[data-testid="minutes-decision"]').first().textContent();
    check("decision shown", (decisionText ?? "").includes(DECISION));
  } catch (e) {
    check(`exception: ${e.message}`, false);
  }

  return finish(results, browser);
})();
