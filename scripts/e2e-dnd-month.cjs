// E2E: drop a meeting on the NEXT-MONTH arrow → moves to the same Jalali day next month
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
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // meeting mid-next-week (inside current month view)
  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() + 4 * 86400000);
  start.setUTCHours(8, 0, 0, 0);
  const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `عبور ماه ${uniq}`,
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [],
    },
  });
  const mid = (await created.json())?.data?.meeting?.id;
  const origStart = (await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json())?.data?.meeting?.startAt;

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(500); }

  // drag the chip onto the NEXT-month arrow (بعدی)
  const dropped = await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    const arrow = document.querySelector('button[aria-label="بعدی"]');
    if (!chip || !arrow) return { chip: !!chip, arrow: !!arrow };
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    arrow.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    arrow.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    chip.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    return { chip: true, arrow: true };
  }, mid);
  await page.waitForTimeout(1200);

  const modal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? { visible: true, text: dlg.textContent.replace(/\s+/g, " ").slice(0, 140) } : { visible: false };
  });
  console.log("drop:", JSON.stringify(dropped), "| modal:", modal.text ?? "none");

  let newStart = null;
  if (modal.visible) {
    await page.locator('button:has-text("تأیید جابه‌جایی")').last().click();
    await page.waitForTimeout(2200);
    newStart = (await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json())?.data?.meeting?.startAt;
  }

  // expect: same day-number + ~30/31 days later
  const o = new Date(new Date(origStart).getTime() + 210 * 60000);
  const nw = new Date(new Date(newStart).getTime() + 210 * 60000);
  const dayDiff = Math.round((nw - o) / 86400000);
  // Jalali same-day check: 26 Shahrivar → 26 Mehr (Gregorian dates differ by ~30-31d)
  const sameDayNum = (dayDiff >= 29 && dayDiff <= 32);
  const ok = modal.visible && sameDayNum;
  console.log(`orig: ${o.toISOString().slice(0, 10)} → new: ${nw ? nw.toISOString().slice(0, 10) : "?"} (Δ${dayDiff}d, same-day# ${sameDayNum})`);
  console.log(ok ? "MONTH-CROSSING DROP WORKS ✅" : "FAILED ❌");

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("ERR", String(e).slice(0, 150)); process.exit(1); });
