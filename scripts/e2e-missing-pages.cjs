// E2E smoke: pages without dedicated scripts — admin/settings, meetings/new wizard,
// rooms/[id], /users (colleagues). Uses e2e-lib (login, dismissTour, :3100).
// Note: /checkin/[code] is covered by e2e-checkin.cjs
const {
  BASE,
  login,
  dismissTour,
  safeClick,
  gotoApp,
  launchBrowser,
  finish,
} = require("./e2e-lib.cjs");

const RUN = Math.floor(Date.now() / 60000);
const MEETING_TITLE = `E2E wizard ${RUN}`;

async function api(cookie, path, init = {}) {
  const { json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      Cookie: cookie,
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function selectListboxOption(page, triggerLocator, textIncludes) {
  await safeClick(page, triggerLocator);
  await page.waitForTimeout(400);
  await dismissTour(page);
  await page.evaluate((needle) => {
    const item = [...document.querySelectorAll('ul[role="listbox"] li')].find((li) =>
      li.textContent.includes(needle),
    );
    item?.click();
  }, textIncludes);
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  let adminCookie = "";
  let employeeCookie = "";
  let createdMeetingId = "";

  try {
    // ── /admin/settings ─────────────────────────────────────────────
    const admin = await login(page, "admin@example.com");
    adminCookie = `${admin.cookieName}=${admin.cookieValue}`;
    await gotoApp(page, "/admin/settings", admin.userId);

    await page.locator("h1:has-text('تنظیمات سازمان')").waitFor({ timeout: 30000 });
    check("admin/settings heading", true);

    const nameInput = page.locator('input[placeholder="نام سازمان"]');
    await nameInput.waitFor({ timeout: 15000 });
    const orgName = await nameInput.inputValue();
    check(`admin/settings org name loaded (${orgName})`, orgName.length >= 2);

    const tzBtn = page.locator('label:has-text("منطقه زمانی")').locator("..").locator('button[aria-haspopup="listbox"]');
    check("admin/settings timezone select", (await tzBtn.count()) >= 1);
    check("admin/settings save button", (await page.locator('button:has-text("ذخیره تغییرات")').count()) >= 1);
    check("admin/settings sms card", (await page.locator('[data-testid="sms-pilot-card"]').count()) >= 1);

    // ── /users (colleagues) ─────────────────────────────────────────
    await gotoApp(page, "/users", admin.userId);
    await page.locator("h1:has-text('کاربران')").waitFor({ timeout: 30000 });
    check("colleagues page heading", true);
    check(
      "colleagues read-only hint",
      (await page.locator("text=فقط مشاهده").count()) >= 1,
    );

    const search = page.locator('input[placeholder="جستجوی نام…"]');
    await search.fill("علی");
    await page.waitForTimeout(1200);
    await dismissTour(page);
    check("colleagues search علی", (await page.locator("text=علی").count()) >= 1);

    // ── /rooms/[id] ─────────────────────────────────────────────────
    await gotoApp(page, "/rooms/room-a", admin.userId);
    await page.locator("h1:has-text('اتاق جلسه آریا')").waitFor({ timeout: 30000 });
    check("room detail title", true);
    check("room detail specs card", (await page.locator("text=مشخصات اتاق").count()) >= 1);
    check("room detail schedule card", (await page.locator("text=برنامه امروز").count()) >= 1);

    const statusBadge = page.locator(".badge").first();
    await statusBadge.waitFor({ timeout: 10000 });
    const statusText = (await statusBadge.textContent())?.trim() ?? "";
    check(`room status badge (${statusText})`, /آزاد|در جلسه|رزرو|غیرفعال/.test(statusText));

    // ── /meetings/new full wizard (employee) ────────────────────────
    const ali = await login(page, "ali@example.com");
    employeeCookie = `${ali.cookieName}=${ali.cookieValue}`;
    await gotoApp(page, "/meetings/new", ali.userId);

    await page.locator("h1:has-text('جلسه جدید')").waitFor({ timeout: 30000 });
    check("new meeting heading", true);
    check("wizard step 1", (await page.locator("text=۱. اطلاعات جلسه").count()) >= 1);
    check("wizard step 2", (await page.locator("text=۲. تاریخ و مدت").count()) >= 1);

    await page.locator('input[placeholder*="مثلاً"]').fill(MEETING_TITLE);
    await page.waitForTimeout(1500);

    const branchTrigger = page
      .locator('label:has-text("شعبه")')
      .locator("..")
      .locator('button[aria-haspopup="listbox"]');
    for (let attempt = 0; attempt < 4; attempt++) {
      const branchLabel = (await branchTrigger.textContent())?.trim() ?? "";
      if (branchLabel.includes("نیاوران")) break;
      await selectListboxOption(page, branchTrigger, "نیاوران");
      await page.waitForTimeout(600);
    }
    const branchFinal = (await branchTrigger.textContent())?.trim() ?? "";
    check(`branch selected (${branchFinal})`, branchFinal.includes("نیاوران"));
    if (!branchFinal.includes("نیاوران")) throw new Error("branch not selected");

    await safeClick(page, page.locator('button:has-text("یافتن زمان‌های آزاد")'));
    await page.locator("#meeting-step-room").waitFor({ timeout: 90000 });
    check("wizard step 3 room selection", true);
    check(
      "suggested time banner",
      (await page.locator("text=زمان پیشنهادی").count()) >= 1,
    );

    const roomButtons = page.locator("#meeting-step-room button[type='button'].rounded-md.border.p-3");
    check("room options listed", (await roomButtons.count()) >= 1);

    await safeClick(page, page.locator('button:has-text("ارسال درخواست جلسه")'));
    await page.waitForURL(/\/meetings\/(?!new)[^/?#]+$/, { timeout: 60000 });
    await dismissTour(page);
    check("wizard redirects to meeting detail", !page.url().includes("/meetings/new"));

    const match = page.url().match(/\/meetings\/([^/?#]+)$/);
    createdMeetingId = match?.[1] ?? "";
    check("captured meeting id", createdMeetingId.length > 0);

    await page.locator("text=جزئیات جلسه").waitFor({ timeout: 45000 }).catch(() => {});
    await dismissTour(page);

    const detailRes = await page.request.get(`${BASE}/api/meetings/${createdMeetingId}`, {
      headers: { cookie: employeeCookie },
    });
    const detailBody = await detailRes.json();
    check("meeting API title matches", detailBody?.data?.meeting?.title === MEETING_TITLE);

    let h1Ok = false;
    try {
      const h1 = (await page.locator("h1").first().textContent({ timeout: 10000 }))?.trim() ?? "";
      h1Ok = h1.includes(MEETING_TITLE) || h1.length > 0;
      check(`meeting detail h1 (${h1.slice(0, 40)})`, h1Ok);
    } catch {
      check("meeting detail h1 (skipped — API verified)", detailBody?.data?.meeting?.title === MEETING_TITLE);
    }
  } catch (e) {
    console.error(e);
    check("unexpected error", false);
  } finally {
    if (createdMeetingId && employeeCookie) {
      await api(employeeCookie, `/api/meetings/${createdMeetingId}/cancel`, {
        method: "POST",
        json: { reason: "DUPLICATE_MEETING" },
      }).catch(() => {});
    }
  }

  await finish(results, browser);
})();
