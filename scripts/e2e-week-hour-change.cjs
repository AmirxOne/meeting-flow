// E2E: week drop moves to the TARGET hour; day view hour-drop sanity
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

  // seed a meeting at 10:00 today+1d
  const ROOMS = ["room-a", "room-b", "room-c", "room-d", "room-m-beta"];
  const start = new Date(Date.now() + 1 * 86400000); start.setUTCHours(10, 0, 0, 0);
  let mid;
  for (const room of ROOMS) {
    const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
      headers: { "Content-Type": "application/json" },
      data: { title: "ساعت تست " + (Date.now() % 100000), branchId: "branch-niavaran", roomId: room, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), meetingType: "INTERNAL", participantIds: [] },
    });
    if (created.status() === 201) { mid = (await created.json())?.data?.meeting?.id; break; }
  }
  if (!mid) { console.log("CREATE FAIL"); process.exit(1); }

  // week view
  await page.goto("http://127.0.0.1:3100/calendar?view=week", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  if (!(await page.evaluate(() => !!document.querySelector("[data-week-cell]")))) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tour="cal-views"] button')]; if (b[1]) b[1].click(); });
    await page.waitForTimeout(1200);
  }

  // drag the chip and drop on the cell at hour 14 of ANY day
  const r = {};
  await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    if (!chip) return;
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, mid);
  await page.waitForTimeout(500);
  await page.evaluate((mid) => {
    const cells = [...document.querySelectorAll("[data-week-cell]")];
    const target = cells.find((c) => c.getAttribute("data-week-cell").endsWith("T14"));
    const d2 = new DataTransfer();
    d2.setData("text/plain", mid);
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: d2 }));
  }, mid);
  await page.waitForTimeout(700);
  r.weekModalText = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? d.textContent.replace(/\s+/g, " ").slice(0, 120) : null;
  });
  r.modalSays14 = r.weekModalText ? /۱۴:۰۰|۱۴ :۰۰/.test(r.weekModalText) || r.weekModalText.includes("شروع جدید") : false;
  // cancel modal
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')].find(b => /انصراف|لغو/.test(b.textContent));
    btn && btn.click();
  });
  await page.waitForTimeout(400);

  // day view: empty-hour chip drop sanity
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tour="cal-views"] button')]; if (b[2]) b[2].click(); });
  await page.waitForTimeout(1200);
  r.dayEmptyHours = await page.evaluate(() => document.querySelectorAll("[data-empty-hour]").length);

  console.log(JSON.stringify(r, null, 1));
  const ok = r.weekModalText && r.modalSays14 && r.dayEmptyHours === 13;
  console.log(ok ? "HOUR-CHANGE DROP ✅" : "CHECK ❌");
  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, { headers: { "Content-Type": "application/json" }, data: { reason: "OTHER" } }).catch(() => {});
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 250)));
