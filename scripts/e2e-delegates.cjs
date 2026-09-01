// E2E: booking delegates — manager appoints from profile; wizard shows organizer select.
const { login, gotoApp, safeClick, launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  let adminCookie = "";
  let delegateRowId = "";
  let aliId = "";

  try {
    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const admin = await login(adminPage, "admin@example.com");
    adminCookie = `${admin.cookieName}=${admin.cookieValue}`;

    const usersRes = await adminPage.request.get(`${BASE}/api/users`);
    const usersBody = await usersRes.json().catch(() => ({}));
    const aliUser = (usersBody?.data?.users ?? []).find(
      (u) => u.email === "ali@example.com" || u.fullName === "علی رضایی",
    );
    aliId = aliUser?.id ?? "";
    check("resolved ali user id", typeof aliId === "string" && aliId.length > 8);

    const existing = await adminPage.request.get(`${BASE}/api/delegates`);
    const existingBody = await existing.json().catch(() => ({}));
    for (const row of existingBody?.data?.delegates ?? []) {
      if (row.user?.id === aliId) {
        await adminPage.request.delete(`${BASE}/api/delegates/${row.id}`);
      }
    }

    await gotoApp(adminPage, "/profile", admin.userId);
    await adminPage.locator('[data-testid="delegates-card"]').waitFor({ timeout: 30000 });
    check("profile shows delegates card", true);

    await safeClick(adminPage, adminPage.locator('[data-testid="delegate-add-btn"]'));
    await adminPage.locator('[role="dialog"]').waitFor({ timeout: 15000 });
    check("add-delegate modal opened", true);

    const aliBtn = adminPage.locator('[role="dialog"] button').filter({ hasText: "علی رضایی" });
    await aliBtn.first().waitFor({ timeout: 15000 });
    await safeClick(adminPage, aliBtn);
    await safeClick(adminPage, adminPage.locator('[role="dialog"] button:has-text("افزودن")').first());
    await adminPage.locator('[data-testid="delegate-list"]').waitFor({ timeout: 15000 });
    const listed = await adminPage.locator('[data-testid="delegate-list"]').textContent();
    check("ali appears in delegate list", (listed ?? "").includes("علی رضایی"));

    const listRes = await adminPage.request.get(`${BASE}/api/delegates`);
    const listBody = await listRes.json().catch(() => ({}));
    const row = (listBody?.data?.delegates ?? []).find((d) => d.user?.id === aliId);
    delegateRowId = row?.id ?? "";
    check("delegate row persisted", !!delegateRowId);
    await adminPage.close();

    const aliCtx = await browser.newContext();
    const aliPage = await aliCtx.newPage();
    await aliPage.setViewportSize({ width: 1440, height: 900 });
    const ali = await login(aliPage, "ali@example.com");
    await gotoApp(aliPage, "/meetings/new", ali.userId);
    await aliPage.locator("h1:has-text('جلسه جدید')").waitFor({ timeout: 30000 });
    const orgSelect = aliPage.locator('[data-testid="meeting-organizer"]');
    await orgSelect.waitFor({ timeout: 20000 });
    check("wizard shows organizer select", (await orgSelect.count()) === 1);
    const orgText = await orgSelect.textContent();
    check(
      "wizard option names manager",
      (orgText ?? "").includes("علیرضا محمدی") || (orgText ?? "").includes("برگزارکننده"),
    );
    await aliCtx.close();
  } catch (e) {
    check(`exception: ${e.message}`, false);
  } finally {
    if (delegateRowId && adminCookie) {
      try {
        await fetch(`${BASE}/api/delegates/${delegateRowId}`, {
          method: "DELETE",
          headers: { Cookie: adminCookie },
        });
      } catch {
        /* ignore */
      }
    }
  }

  await finish(results, browser);
})();
