(async () => {
// E2E: privacy tick flows end-to-end in both forms + badge in queue + carried to meeting
const r = {};
// 1) public guest form has the checkbox and it submits
const g0 = await fetch("http://127.0.0.1:3100/api/public/people");
const dir = await g0.json();
const g = await fetch("http://127.0.0.1:3100/api/public/meeting-requests", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "محرمانه تست مهمان", guestName: "مهمان محرمانه", guestPhone: "09121110002", urgency: "NORMAL", durationMin: 30, isPrivate: true }),
});
const gj = await g.json();
r.publicSubmit = g.status === 201 && gj?.data?.request?.isPrivate === true;

// 2) internal (ali) form API
const rl = await fetch("http://127.0.0.1:3100/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "sara@example.com", password: "Pass1234" }) });
const cookie = rl.headers.get("set-cookie").split(";")[0];
const er = await fetch("http://127.0.0.1:3100/api/meeting-requests", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ title: "محرمانه تست داخلی", urgency: "NORMAL", durationMin: 30, isPrivate: true }) });
const ej = await er.json();
r.internalSubmit = er.status === 201 && ej?.data?.request?.isPrivate === true;

// 3) UI: both forms show the checkbox
const { chromium } = require("playwright");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3100/request", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);
r.publicCheckbox = await page.evaluate(() => document.body.innerText.includes("جلسه محرمانه — موضوع و جزئیات فقط برای من"));

const ra = await fetch("http://127.0.0.1:3100/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@example.com", password: "Pass1234" }) });
for (const c of ra.headers.getSetCookie()) { const p = c.split(";")[0]; const i = p.indexOf("="); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: "127.0.0.1", path: "/" }]); }
await page.goto("http://127.0.0.1:3100/meeting-requests", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
r.internalCheckbox = await page.evaluate(() => document.body.innerText.includes("جلسه محرمانه — موضوع و جزئیات فقط برای خودم"));

// 4) queue shows badge for the private requests
await page.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
r.queueBadge = await page.evaluate(() => {
  const p = [...document.querySelectorAll("p.font-bold")].find(el => el.textContent.includes("محرمانه تست مهمان"));
  return !!p && !!p.querySelector("span");
});

// 5) schedule carries privacy into the meeting
const gid = gj?.data?.request?.id;
const rooms = await (await fetch("http://127.0.0.1:3100/api/rooms", { headers: { cookie: adminCookie() } })).json();
function adminCookie() { return undefined; }
const adminCookieStr = ra.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
const rooms2 = await (await fetch("http://127.0.0.1:3100/api/rooms", { headers: { cookie: adminCookieStr } })).json();
const start = new Date(Date.now() + 7 * 86400000); start.setUTCHours(8, 0, 0, 0);
let sched = null;
for (const room of rooms2.rooms ?? []) {
  const sr = await fetch(`http://127.0.0.1:3100/api/meeting-requests/${gid}/schedule`, { method: "POST", headers: { "Content-Type": "application/json", cookie: adminCookieStr }, body: JSON.stringify({ branchId: room.branchId, roomId: room.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + 1800000).toISOString() }) });
  if (sr.status === 201) { sched = await sr.json(); break; }
}
r.scheduledPrivate = sched?.data?.meeting?.isPrivate === true;

console.log(JSON.stringify(r, null, 1));
console.log(Object.values(r).every(Boolean) ? "PRIVACY FLOW ✅" : "SOME FAILED ❌");
await browser.close();

})().catch(e => console.log("ERR", String(e).slice(0, 200)));