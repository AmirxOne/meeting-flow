// E2E: hour-slot drag & drop in the day timeline (side panel of month view)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => { console.log("NATIVE DIALOG ❌"); d.accept(); });

  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // meeting tomorrow at 10:00 (1h) — appears in the day panel
  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() + 2 * 86400000);
  start.setUTCHours(6, 30, 0, 0); // 10:00 Tehran
  let created, mid = null;
  for (const room of ["room-d", "room-a", "room-b", "room-c", "room-m-beta"]) {
    created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `درگ ساعت ${uniq}`,
      branchId: "branch-niavaran",
      roomId: room,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [],
    },
  });
    if (created.status() === 201) { mid = (await created.json())?.data?.meeting?.id; break; }
  }
  console.log("meeting:", !!mid);

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(500); }

  // switch to the DAY view where the hour timeline renders
  const dayBtn = page.locator('[data-tour="cal-views"] button').nth(2); // ماه/هفته/روز
  if (await dayBtn.count()) { await dayBtn.click(); await page.waitForTimeout(1500); }
  // navigate forward until the meeting chip appears (meeting is 2 days ahead)
  for (let i = 0; i < 4; i++) {
    if (await page.locator(`[data-mid="${mid}"]`).count()) break;
    await page.locator('button[aria-label*="بعد"]').first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  console.log("day view, chip present:", (await page.locator(`[data-mid="${mid}"]`).count()) > 0);

  // drag to ANOTHER existing hour row (the timeline only renders occupied hours)
  const dropped = await page.evaluate((mid) => {
    const card = document.querySelector(`[data-tour="day-timeline"] [data-mid="${mid}"]`);
    if (!card) return { card: false, hour: false, target: null };
    const srcRow = card.closest("[id^='day-hour']");
    const rows = [...document.querySelectorAll("[id^='day-hour']")];
    const target = rows.find((r) => r !== srcRow) ?? rows[0];
    if (!target) return { card: true, hour: false, target: null };
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    card.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    return { card: true, hour: true, target: target.id };
  }, mid);
  console.log("dnd:", JSON.stringify(dropped));
  await page.waitForTimeout(1200);

  const modal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { visible: false };
    const r = dlg.getBoundingClientRect();
    return { visible: r.width > 100, text: dlg.textContent.replace(/\s+/g, " ").slice(0, 150) };
  });
  console.log("modal:", JSON.stringify(modal));

  let moved = null; let movedOk = false;
  if (modal.visible) {
    await page.locator('button:has-text("تأیید جابه‌جایی")').last().click();
    await page.waitForTimeout(2200);
    const det = await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json();
    const st = det?.data?.meeting?.startAt;
    moved = st ? new Date(new Date(st).getTime() + 210 * 60000).getUTCHours() : null;
    const expect = dropped.target ? Number(dropped.target.replace("day-hour-", "")) : -1;
    console.log("new start hour (Tehran):", moved, "(expect", expect + ")");
    movedOk = moved === expect;
  }

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});

  const ok = modal.visible && movedOk;
  console.log(ok ? "HOUR DROP WORKS ✅" : "HOUR DROP FAILED ❌");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("ERR", String(e).slice(0, 150)); process.exit(1); });
