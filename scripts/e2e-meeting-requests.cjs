// E2E: employer model — employee REQUESTS a meeting, admin SCHEDULES it
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const results = [];
  const check = (n, ok) => { results.push([n, !!ok]); console.log((ok ? "PASS" : "FAIL") + " | " + n); };

  async function login(page, email) {
    const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
      data: { email, password: "Pass1234" },
    });
    if (res.status() !== 200) throw new Error("login " + email + " → " + res.status());
    const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
    const [n, v] = sc.value.split(";")[0].split("=");
    await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  }

  // ── 1. employee CANNOT create a meeting directly (403) ──
  const empCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const emp = await empCtx.newPage();
  await login(emp, "ali@example.com");
  const soon = new Date(Date.now() + 4 * 86400000);
  soon.setUTCHours(12, 0, 0, 0);
  const direct = await emp.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: "تست مستقیم — نباید ساخته شود",
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: soon.toISOString(),
      endAt: new Date(soon.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [],
    },
  });
  check(`employee direct create → ${direct.status()} (blocked)`, direct.status() === 403);

  // ── 2. employee files a REQUEST ──
  const uniq = Date.now() % 100000;
  const req = await emp.request.post("http://127.0.0.1:3100/api/meeting-requests", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `درخواست تست ${uniq} — جلسه تیم فروش`,
      description: "بررسی اهداف فصل",
      urgency: "URGENT",
      durationMin: 60,
      participantIds: [],
    },
  });
  const reqBody = await req.json();
  const requestId = reqBody?.data?.request?.id;
  check(`employee files request → ${req.status()}`, req.status() === 201 && !!requestId);

  // request page renders for employee
  await emp.goto("http://127.0.0.1:3100/meeting-requests", { waitUntil: "domcontentloaded", timeout: 60000 });
  await emp.waitForTimeout(2500);
  const empPage = await emp.evaluate(() => document.body.innerText);
  check("employee sees own request in page", empPage.includes(`درخواست تست ${uniq}`));
  check("employee request page has no 500", !empPage.includes("خطای غیرمنتظره"));

  // ── 3. ADMIN sees the queue & schedules it ──
  const admCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adm = await admCtx.newPage();
  await login(adm, "admin@example.com");
  await adm.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
  await adm.waitForTimeout(2800);
  const queue = await adm.evaluate(() => document.body.innerText);
  check("admin queue lists the request", queue.includes(`درخواست تست ${uniq}`));
  check("admin queue no 500", !queue.includes("خطای غیرمنتظره"));

  // schedule via API (UI form does the same)
  const slot = new Date(Date.now() + 5 * 86400000);
  slot.setUTCHours(9, 30, 0, 0);
  const sched = await adm.request.post(`http://127.0.0.1:3100/api/meeting-requests/${requestId}/schedule`, {
    headers: { "Content-Type": "application/json" },
    data: {
      branchId: "branch-niavaran",
      roomId: "room-d",
      startAt: slot.toISOString(),
      endAt: new Date(slot.getTime() + 3600000).toISOString(),
    },
  });
  const schedBody = await sched.json();
  check(`admin schedules → ${sched.status()}`, sched.status() === 200 && !!schedBody?.data?.meeting?.id);

  // ── 4. request closed; meeting visible to employee as organizer ──
  const mine = await emp.request.get("http://127.0.0.1:3100/api/meeting-requests");
  const mineBody = await mine.json();
  const updated = (mineBody?.data?.items ?? []).find((x) => x.id === requestId);
  check("request status → SCHEDULED", updated?.status === "SCHEDULED");
  check("request linked to meeting", !!updated?.meeting?.id);

  // employee sees the real meeting now (they're the organizer)
  await emp.goto("http://127.0.0.1:3100/meetings", { waitUntil: "domcontentloaded", timeout: 60000 });
  await emp.waitForTimeout(2500);
  const empMeetings = await emp.evaluate(() => document.body.innerText);
  check("employee sees the scheduled meeting in their list", empMeetings.includes(`درخواست تست ${uniq}`));

  // ── 5. employee cannot schedule someone's request (403) ──
  const otherReq = await emp.request.post(`http://127.0.0.1:3100/api/meeting-requests/${requestId}/schedule`, {
    headers: { "Content-Type": "application/json" },
    data: {
      branchId: "branch-niavaran",
      roomId: "room-d",
      startAt: slot.toISOString(),
      endAt: new Date(slot.getTime() + 3600000).toISOString(),
    },
  });
  check(`employee cannot schedule → ${otherReq.status()}`, otherReq.status() === 403 || otherReq.status() === 409);

  let pass = 0;
  for (const [, ok] of results) if (ok) pass++;
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
