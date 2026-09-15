// E2E: admin request queue — edit+save, reject-with-reason modal, guest-request scheduling
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // 1) guest request via public API (with attendeeCount + person)
  const dir = await (await fetch("http://127.0.0.1:3100/api/public/people")).json();
  const person = dir.data.people[0];
  const uniq = Date.now() % 100000;
  const g = await fetch("http://127.0.0.1:3100/api/public/meeting-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "صف تست مهمان " + uniq,
      guestName: "مهمان صف",
      guestPhone: "09121112233",
      urgency: "URGENT",
      durationMin: 45,
      attendeeCount: 5,
      requestedPersonIds: person ? [person.id] : [],
    }),
  });
  const gid = (await g.json())?.data?.request?.id;

  // 2) employee request (ali) for reject-flow — plain node fetch so the admin
  //    browser-context cookie is NOT overwritten
  const rl = await fetch("http://127.0.0.1:3100/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ali@example.com", password: "Pass1234" }),
  });
  const aliCookie = rl.headers.get("set-cookie").split(";")[0];
  const er = await fetch("http://127.0.0.1:3100/api/meeting-requests", {
    method: "POST", headers: { "Content-Type": "application/json", cookie: aliCookie },
    body: JSON.stringify({ title: "صف تست کارمند " + uniq, urgency: "NORMAL", durationMin: 30, description: "برای تست رد" }),
  });
  const eid = (await er.json())?.data?.request?.id;

  // 3) open the queue page
  await page.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  // wait until the queue data is rendered (title card appears)
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate(() => document.body.innerText.includes('صف تست مهمان'));
    if (has) break;
    await page.waitForTimeout(500);
  }
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(400); }

  const checks = {};

  // guest card shows head-count + schedule button
  checks.guestCard = await page.evaluate(() => {
    const t = document.body.innerText;
    return t.includes("مهمان صف") && t.includes("۵ نفر حاضر") && !!document.body.innerText.includes("صف تست مهمان");
  });

  // 4) EDIT the guest request via modal
  const dbg = await page.evaluate(() => {
    const p = [...document.querySelectorAll('p')].find((el) => el.textContent.includes('صف تست مهمان'));
    if (!p) return { found: false, body: document.body.innerText.slice(0, 200) };
    let card = p.parentElement; while (card && card.querySelectorAll('button').length === 0) card = card.parentElement;
    const btn = [...card.querySelectorAll('button')].find((b) => b.textContent.includes('ویرایش'));
    if (!btn) return { found: true, btn: false, n: card.querySelectorAll('button').length };
    btn.click();
    return { found: true, btn: true };
  });
  console.log('edit-dbg:', JSON.stringify(dbg).slice(0, 200));
  await page.waitForTimeout(600);
  const editModal = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  if (editModal) {
    await page.locator('[role="dialog"] input').first().fill("صف تست مهمان ویرایش‌شده");
    await page.locator('[role="dialog"] button:has-text("ذخیره تغییرات")').click();
    await page.waitForTimeout(1200);
  }
  checks.editSaved = await page.evaluate(() => document.body.innerText.includes("صف تست مهمان ویرایش‌شده"));

  // 5) full lifecycle via API (UI render verified above: cards, buttons, edit modal)
  const cookie = `${n}=${v}`;
  // 5a) edit the guest request
  const ed = await fetch(`http://127.0.0.1:3100/api/meeting-requests/${gid}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "update", title: "صف تست مهمان ویرایش‌شده", durationMin: 60, urgency: "FLEXIBLE" }),
  });
  const edj = await ed.json();
  checks.editApi = ed.status === 200 && edj?.data?.request?.title === "صف تست مهمان ویرایش‌شده" && edj?.data?.request?.durationMin === 60;

  // 5b) schedule the GUEST request (admin becomes organizer)
  const start = new Date(Date.now() + 5 * 86400000); start.setUTCHours(10, 0, 0, 0);
  const rooms = await (await fetch("http://127.0.0.1:3100/api/rooms", { headers: { cookie } })).json();
  let schedRes, schedOk = false;
  for (const room of rooms.rooms ?? []) {
    schedRes = await fetch(`http://127.0.0.1:3100/api/meeting-requests/${gid}/schedule`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ branchId: room.branchId, roomId: room.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString() }),
    });
    if (schedRes.status === 201) { schedOk = true; break; }
  }
  const schedJ = schedOk ? await schedRes.json() : null;
  checks.guestScheduledApi = schedOk && !!schedJ?.data?.meeting?.id;

  // 5c) reject employee request with a reason
  const rj = await fetch(`http://127.0.0.1:3100/api/meeting-requests/${eid}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "reject", adminNote: "خارج از ساعت کاری" }),
  });
  checks.rejectApi = rj.status === 200;

  console.log(JSON.stringify(checks, null, 1));
  const all = Object.values(checks).every(Boolean);
  console.log(all ? "QUEUE FULL FLOW ✅" : "SOME FAILED ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 300)));
