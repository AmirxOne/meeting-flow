// E2E: recurring meetings — create a series, see it on the calendar, wizard has custom Select
const { login, gotoApp, launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const { userId } = await login(page, "admin@example.com");

  const uniq = Date.now() % 100000;
  const title = `استندآپ تکرار ${uniq}`;
  const start = new Date(Date.now() + 4 * 86400000);
  start.setUTCHours(17, 30 + (uniq % 10), 0, 0); // ~21:00 Tehran
  const end = new Date(start.getTime() + 30 * 60000);

  const create = await page.request.post(`${BASE}/api/meetings`, {
    headers: { "Content-Type": "application/json" },
    data: {
      title,
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      meetingType: "INTERNAL",
      recurrence: { freq: "DAILY", interval: 1, count: 3 },
    },
  });
  const createdBody = await create.json();
  const meeting = createdBody.data?.meeting;
  check(
    `admin: daily series created (${create.status()}, count=${createdBody.data?.occurrenceCount})`,
    create.status() === 201 && createdBody.data?.occurrenceCount === 3 && !!meeting?.seriesId,
  );

  const from = new Date(start.getTime() - 86400000).toISOString();
  const to = new Date(start.getTime() + 6 * 86400000).toISOString();
  const cal = await page.request.get(`${BASE}/api/calendar?from=${from}&to=${to}&scope=all`);
  const calBody = await cal.json();
  const occ = (calBody.data?.meetings ?? []).filter((m) => m.title === title);
  check(`admin: calendar API shows ${occ.length} occurrences`, occ.length === 3);

  await gotoApp(page, "/calendar", userId);
  const ui = await page.evaluate(() => document.body.textContent || "");
  check("admin: series title visible on calendar page", ui.includes(title));

  await gotoApp(page, "/meetings/new", userId);
  const wizard = await page.evaluate(() => document.body.textContent || "");
  check("wizard shows «تکرار جلسه»", wizard.includes("تکرار جلسه"));
  const nativeSelects = await page.locator("select").count();
  check("wizard has no native <select>", nativeSelects === 0);

  // ali creates a private series; admin must see it masked
  const ctxAli = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageAli = await ctxAli.newPage();
  const { userId: aliId } = await login(pageAli, "ali@example.com");
  const privateTitle = `کمیته محرمانه ${uniq}`;
  const pStart = new Date(start.getTime() + 8 * 86400000);
  const pEnd = new Date(pStart.getTime() + 30 * 60000);
  const privateCreate = await pageAli.request.post(`${BASE}/api/meetings`, {
    headers: { "Content-Type": "application/json" },
    data: {
      title: privateTitle,
      branchId: "branch-niavaran",
      roomId: "room-b",
      startAt: pStart.toISOString(),
      endAt: pEnd.toISOString(),
      meetingType: "INTERNAL",
      isPrivate: true,
      recurrence: { freq: "WEEKLY", interval: 1, count: 2 },
    },
  });
  const privateBody = await privateCreate.json();
  check(
    `ali: private weekly series created (${privateCreate.status()})`,
    privateCreate.status() === 201 && privateBody.data?.occurrenceCount === 2,
  );

  const pFrom = new Date(pStart.getTime() - 86400000).toISOString();
  const pTo = new Date(pStart.getTime() + 16 * 86400000).toISOString();
  const adminCal = await page.request.get(`${BASE}/api/calendar?from=${pFrom}&to=${pTo}&scope=all`);
  const adminCalBody = await adminCal.json();
  const privateRows = (adminCalBody.data?.meetings ?? []).filter(
    (m) => m.seriesId === privateBody.data?.meeting?.seriesId,
  );
  check(
    "admin: private series masked on calendar API",
    privateRows.length >= 1 &&
      privateRows.every((m) => m.isMasked && m.title === "جلسه محرمانه") &&
      !(adminCalBody.data?.meetings ?? []).some((m) => m.title === privateTitle),
  );

  await gotoApp(pageAli, "/calendar", aliId);
  // ali (organizer) should see the real title in list API
  const aliList = await pageAli.request.get(`${BASE}/api/meetings?scope=mine&limit=200`);
  const aliListBody = await aliList.json();
  check(
    "ali: sees real private series title",
    (aliListBody.data?.meetings ?? []).some((m) => m.title === privateTitle),
  );

  // cleanup
  if (meeting?.id) {
    await page.request.post(`${BASE}/api/meetings/${meeting.id}/cancel`, {
      headers: { "Content-Type": "application/json" },
      data: { reason: "OTHER", scope: "ALL" },
    });
  }
  if (privateBody.data?.meeting?.id) {
    await pageAli.request.post(`${BASE}/api/meetings/${privateBody.data.meeting.id}/cancel`, {
      headers: { "Content-Type": "application/json" },
      data: { reason: "OTHER", scope: "ALL" },
    });
  }

  await ctxAli.close();
  await finish(results, browser);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
