// E2E: hold the dragged chip on the LEFT edge → calendar auto-advances months
const { chromium } = require("playwright");

(async () => {
  const ROOMS = ["room-a", "room-b", "room-c", "room-d", "room-m-beta"];
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

  const start = new Date(Date.now() + 3 * 86400000); start.setUTCHours(11, 0, 0, 0);
  const uniq = Date.now() % 100000;
  const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: { title: "اتو تست " + uniq, branchId: "branch-niavaran", roomId: ROOMS[Date.now() % 5], startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), meetingType: "INTERNAL", participantIds: [] },
  });
  const mid = (await created.json())?.data?.meeting?.id;

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(400); }

  const headerBefore = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2, h3, [class*=font-bold]")].map(e => e.textContent.trim());
    return h.find(t => /۱۴۰۵|1405/.test(t)) || "";
  });

  // start drag → wait for dock → hold dragover on the LEFT dock for ~2.2s
  await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, mid);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    const dt = new DataTransfer();
    dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
    dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  // hold: keep dragover alive so no dragleave fires
  await page.waitForTimeout(2200);
  const headerAfter = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2, h3, [class*=font-bold]")].map(e => e.textContent.trim());
    return h.find(t => /۱۴۰۵|1405/.test(t)) || "";
  });
  console.log("before:", JSON.stringify(headerBefore), "| after 2.2s hold:", JSON.stringify(headerAfter));
  const moved = headerBefore !== headerAfter;
  console.log(moved ? "AUTO-ADVANCE WORKS ✅" : "NO AUTO-ADVANCE ❌");

  await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    chip && chip.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
  }, mid);
  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, { headers: { "Content-Type": "application/json" }, data: { reason: "OTHER" } }).catch(() => {});
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 150)));
