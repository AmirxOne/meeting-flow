// E2E: per-user Google Calendar connect/disconnect on profile (mock OAuth — no real Google).
const { login, gotoApp, safeClick, launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  const { cookieName, cookieValue, userId } = await login(page, "ali@example.com");
  const cookie = `${cookieName}=${cookieValue}`;

  try {
    await page.request.delete(`${BASE}/api/calendar/google`, {
      headers: { cookie },
    });

    await gotoApp(page, "/profile", userId);

    const card = page.locator('[data-testid="google-calendar-card"]');
    await card.waitFor({ timeout: 20000 });
    check("profile shows google calendar card", (await card.count()) > 0);

    const connect = page.locator('[data-testid="google-calendar-connect"]');
    await connect.waitFor({ state: "visible", timeout: 15000 });
    check("connect button visible when disconnected", await connect.isVisible());

    const statusBefore = await page.locator('[data-testid="google-calendar-status"]').innerText();
    check("status says not connected", statusBefore.includes("وصل نیست"));

    await safeClick(page, connect);
    await page.waitForURL(/\/profile/, { timeout: 20000 });
    await page.waitForTimeout(800);

    const connectedStatus = page.locator('[data-testid="google-calendar-status"]');
    await connectedStatus.waitFor({ timeout: 15000 });
    const statusText = await connectedStatus.innerText();
    check("status is وصل است after mock connect", statusText.includes("وصل است"));

    const disconnect = page.locator('[data-testid="google-calendar-disconnect"]');
    check("disconnect button visible", await disconnect.isVisible());

    const statusApi = await page.request.get(`${BASE}/api/calendar/google`, {
      headers: { cookie },
    });
    const statusBody = await statusApi.json();
    check("GET status connected", statusApi.status() === 200 && statusBody.data?.connected === true);

    await safeClick(page, disconnect);
    await page.waitForTimeout(800);

    await page.locator('[data-testid="google-calendar-connect"]').waitFor({
      state: "visible",
      timeout: 15000,
    });
    const after = await page.locator('[data-testid="google-calendar-status"]').innerText();
    check("status disconnected after قطع کن", after.includes("وصل نیست"));

    const anon = await fetch(`${BASE}/api/calendar/google`);
    check("anonymous GET is 401", anon.status === 401);
  } catch (e) {
    console.error(e);
    results.push(["unhandled error", false]);
  } finally {
    try {
      await page.request.delete(`${BASE}/api/calendar/google`, {
        headers: { cookie },
      });
    } catch {
      /* best-effort */
    }
  }

  await finish(results, browser);
})();
