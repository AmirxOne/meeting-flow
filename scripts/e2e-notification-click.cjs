// E2E: notification click → marked read + navigates to the related meeting
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  // ── setup: employee (ali) creates a meeting with the admin as participant,
  //    so admin gets a notification with meetingId ──
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  let res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "ali@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  let [n, v] = sc.value.split(";")[0].split("=");
  const aliCookie = `${n.trim()}=${v.trim()}`;

  // find admin's user id
  res = await page.request.get("http://localhost:3100/api/users?q=" + encodeURIComponent("علیرضا"), { headers: { Cookie: aliCookie } });
  // ali is employee — can't list users; use directory instead to resolve admin's userId
  res = await page.request.get("http://localhost:3100/api/people?q=" + encodeURIComponent("علیرضا محمدی"), { headers: { Cookie: aliCookie } });
  const people = (await res.json()).data.people;
  const adminDir = people.find((p) => p.name === "علیرضا محمدی");
  check("resolved admin from directory", !!adminDir?.id);
  const dirAll = await page.request.get("http://localhost:3100/api/people", { headers: { Cookie: aliCookie } });
  const dirMap = new Map(((await dirAll.json()).data.people).map((p) => [p.id, p.userId]));
  const adminUserId = dirMap.get(adminDir.id);
  check("admin has userId link", !!adminUserId);

  // create meeting with admin as participant (unique far slot to avoid conflicts)
  const t = new Date(Date.now() + 210 * 60000);
  const base = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 210 * 60000;
  const start = new Date(base + 12 * 86400000 + (Date.now() % 40) * 60000);
  const end = new Date(start.getTime() + 30 * 60000);
  res = await page.request.post("http://localhost:3100/api/meetings", {
    headers: { Cookie: aliCookie, "Content-Type": "application/json" },
    data: {
      title: "جلسه تست اعلان کلیک‌شو",
      branchId: "branch-niavaran",
      roomId: "room-b",
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      meetingType: "INTERNAL",
      participantIds: [adminUserId],
    },
  });
  const meetingId = (await res.json()).data.meeting.id;
  check(`meeting created (${res.status()}) with admin participant`, res.status() === 201);

  // ── admin opens notifications ──
  res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc2 = (await res.headersArray()).find((h) => h.name === "set-cookie");
  [n, v] = sc2.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  await page.goto("http://localhost:3100/notifications", { waitUntil: "domcontentloaded" });
  await page.locator("text=جلسه تست اعلان کلیک‌شو").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);

  // it should be unread (bold + red dot)
  const row = page.locator("button", { hasText: "جلسه تست اعلان کلیک‌شو" }).first();
  const hadUnreadDot = await row.locator("span.rounded-full.bg-red-500").count();
  check("notification is unread (red dot)", hadUnreadDot >= 1);

  // click it → should navigate to the meeting
  await row.click();
  await page.waitForFunction(
    (id) => location.pathname === `/meetings/${id}`,
    meetingId,
    { timeout: 30000 },
  );
  check("click navigated to the meeting detail", true);

  // go back to notifications — the item must now be read
  await page.goto("http://localhost:3100/notifications", { waitUntil: "domcontentloaded" });
  await page.locator("text=جلسه تست اعلان کلیک‌شو").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  const rowAfter = page.locator("button", { hasText: "جلسه تست اعلان کلیک‌شو" }).first();
  const dotAfter = await rowAfter.locator("span.rounded-full.bg-red-500").count();
  check("notification marked as read after click (no red dot)", dotAfter === 0);

  // ── filter: only unread hides it ──
  await page.locator('button:has-text("فقط خوانده‌نشده")').click();
  await page.waitForTimeout(600);
  // the INVITATION notification must be hidden when read; the cancel-notification
  // (created seconds ago) may legitimately still show
  const inviteRow = page.locator('button', { hasText: 'دعوت شدید' }).filter({ hasText: 'جلسه تست اعلان کلیک‌شو' });
  const hiddenInUnread = await inviteRow.count();
  check("read invite hidden in 'فقط خوانده‌نشده' filter", hiddenInUnread === 0);

  // ── cleanup: cancel the test meeting ──
  await page.request.post(`http://localhost:3100/api/meetings/${meetingId}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "DUPLICATE_MEETING" },
  });

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
