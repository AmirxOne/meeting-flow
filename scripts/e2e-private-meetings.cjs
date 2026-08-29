// E2E: confidential meetings — masked for non-involved users everywhere
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  async function login(page, email) {
    await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
    const res = await page.request.post("http://localhost:3100/api/auth/login", {
      data: { email, password: "Pass1234" },
    });
    if (res.status() !== 200) throw new Error("login failed " + email);
    const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
    const [n, v] = sc.value.split(";")[0].split("=");
    await page.context().clearCookies();
    await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  }

  // ── ali creates a confidential meeting with amir (NOT sara) ──
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  await login(pageA, "ali@example.com");

  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() + (5 + (Date.now() % 3)) * 86400000);
  start.setUTCHours(10, (Date.now() % 40), 0, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  const create = await pageA.request.post("http://localhost:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `محرمانه ${uniq} — استراتژی مالی`,
      branchId: "branch-niavaran",
      roomId: "room-b",
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      meetingType: "INTERNAL",
      isPrivate: true,
      participantIds: [], // only organizer (ali)
    },
  });
  const meeting = (await create.json()).data.meeting;
  check(`confidential meeting created (${create.status()}, isPrivate)`, create.status() === 201 && meeting.isPrivate === true);

  // ── sara (NOT invited) sees it MASKED in list ──
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageB = await ctxB.newPage();
  await login(pageB, "sara@example.com");

  await pageB.goto("http://localhost:3100/meetings", { waitUntil: "domcontentloaded" });
  await pageB.waitForTimeout(3000);
  const listBody = await pageB.evaluate(() => document.body.textContent);
  check("sara: real title NOT visible in /meetings", !listBody.includes(`محرمانه ${uniq}`));
  check("sara: masked 'جلسه محرمانه' shown", listBody.includes("جلسه محرمانه"));

  // ── sara sees it masked in calendar ──
  await pageB.goto("http://localhost:3100/calendar", { waitUntil: "domcontentloaded" });
  await pageB.waitForTimeout(3000);
  const calBody = await pageB.evaluate(() => document.body.textContent);
  check("sara: calendar masked too", !calBody.includes(`محرمانه ${uniq}`) && calBody.includes("جلسه محرمانه"));

  // ── sara CANNOT open details (403 from API) ──
  const detail = await pageB.request.get(`http://localhost:3100/api/meetings/${meeting.id}`);
  check(`sara: detail API blocked (${detail.status()})`, detail.status() === 403 || detail.status() === 404);

  // ── ali (organizer) sees the REAL title ──
  await pageA.goto("http://localhost:3100/meetings", { waitUntil: "domcontentloaded" });
  await pageA.waitForTimeout(3000);
  const aliBody = await pageA.evaluate(() => document.body.textContent);
  check("ali (organizer): sees real title + محرمانه badge", aliBody.includes(`محرمانه ${uniq}`));

  // ── admin (meeting:view-all) sees the real title ──
  const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageC = await ctxC.newPage();
  await login(pageC, "admin@example.com");
  await pageC.goto("http://localhost:3100/meetings", { waitUntil: "domcontentloaded" });
  await pageC.waitForTimeout(3000);
  const adminBody = await pageC.evaluate(() => document.body.textContent);
  check("admin: sees real title (view-all)", adminBody.includes(`محرمانه ${uniq}`));

  // ── cleanup: cancel ──
  await pageA.request.post(`http://localhost:3100/api/meetings/${meeting.id}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
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
