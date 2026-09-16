// E2E: offsite request (جلسه در محل سازمان دیگر) — submit → queue → schedule without room
(async () => {
  const r = {};
  // 1) employee submits an OFFSITE request
  const rl = await fetch("http://127.0.0.1:3100/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "amir@example.com", password: "Pass1234" }) });
  if (rl.status !== 200) { console.log("login rate-limited"); process.exit(1); }
  const cookie = rl.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const uniq = Date.now() % 100000;
  const req = await fetch("http://127.0.0.1:3100/api/meeting-requests", {
    method: "POST", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ title: "بیرونی تست " + uniq, urgency: "NORMAL", durationMin: 60, venue: "OFFSITE", offsiteOrg: "همراه اول", offsiteNote: "برج ساعی طبقه ۵" }),
  });
  const rj = await req.json();
  r.submitted = req.status === 201 && rj?.data?.request?.venue === "OFFSITE" && rj?.data?.request?.offsiteOrg === "همراه اول";
  const id = rj?.data?.request?.id;

  // 2) UI: form shows the venue selector
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (const c of rl.headers.getSetCookie()) { const p = c.split(";")[0]; const i = p.indexOf("="); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: "127.0.0.1", path: "/" }]); }
  await page.goto("http://127.0.0.1:3100/meeting-requests", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  r.formVenue = await page.evaluate(() => document.body.innerText.includes("محل برگزاری") && document.body.innerText.includes("بیرون از شرکت"));

  // 3) admin queue shows the offsite strip
  const ra = await fetch("http://127.0.0.1:3100/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@example.com", password: "Pass1234" }) });
  const adminCookie = ra.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  await page.evaluate(() => {}); // noop
  await ctx.clearCookies();
  for (const c of ra.headers.getSetCookie()) { const p = c.split(";")[0]; const i = p.indexOf("="); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: "127.0.0.1", path: "/" }]); }
  await page.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  r.queueStrip = await page.evaluate((uniq) => {
    const p = [...document.querySelectorAll("p.font-bold")].find(el => el.textContent.includes("بیرونی تست " + uniq));
    if (!p) return false;
    let card = p; while (card && card.querySelectorAll("button").length === 0) card = card.parentElement;
    return card.textContent.includes("بیرون از شرکت") && card.textContent.includes("همراه اول");
  }, uniq);

  // 4) schedule WITHOUT room → roomless EXTERNAL meeting
  const start = new Date(Date.now() + 9 * 86400000); start.setUTCHours(9, 0, 0, 0);
  const sched = await fetch(`http://127.0.0.1:3100/api/meeting-requests/${id}/schedule`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString() }),
  });
  const sj = await sched.json();
  r.scheduled = (sched.status === 200 || sched.status === 201) && !!sj?.data?.meeting?.id && (!sj?.data?.meeting?.roomId) && sj?.data?.meeting?.meetingType === "EXTERNAL";

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? "OFFSITE FLOW ✅" : "SOME FAILED ❌");
  await browser.close();
})().catch(e => console.log("ERR", String(e).slice(0, 250)));
