// E2E: week-view drag (chip → another day's cell → modal) + day-view empty-hour drop
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

  // seed a meeting at a free slot +4d
  const ROOMS = ["room-a", "room-b", "room-c", "room-d", "room-m-beta"];
  const start = new Date(Date.now() + 1 * 86400000); start.setUTCHours(10, 0, 0, 0);
  let mid;
  for (const room of ROOMS) {
    const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
      headers: { "Content-Type": "application/json" },
      data: { title: "هفته تست " + (Date.now() % 100000), branchId: "branch-niavaran", roomId: room, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), meetingType: "INTERNAL", participantIds: [] },
    });
    if (created.status() === 201) { mid = (await created.json())?.data?.meeting?.id; break; }
  }
  if (!mid) { console.log("CREATE FAIL"); process.exit(1); }

  // ── week view ──
  await page.goto("http://127.0.0.1:3100/calendar?view=week", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  // ensure week view (toggle if needed)
  const inWeek = await page.evaluate(() => !!document.querySelector("[data-week-cell]"));
  if (!inWeek) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-tour="cal-views"] button')];
      if (btns[1]) btns[1].click(); // هفته
    });
    await page.waitForTimeout(1200);
  }
  const r = {};
  r.weekCells = await page.evaluate(() => document.querySelectorAll("[data-week-cell]").length);
  // drag: chip → a cell on a DIFFERENT day
  const weekModal = await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    if (!chip) return { chip: false };
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { chip: true };
  }, mid);
  await page.waitForTimeout(400);
  if (weekModal.chip) {
    await page.evaluate((mid) => {
      // find a cell on another day (different ISO than the chip's day)
      const cells = [...document.querySelectorAll("[data-week-cell]")];
      const target = cells.find((c) => !c.getAttribute("data-week-cell").startsWith(String(new Date().toISOString().slice(0, 10)))) || cells[10];
      const d2 = new DataTransfer();
      d2.setData("text/plain", mid);
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d2 }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    }, mid);
    await page.waitForTimeout(600);
    r.weekModal = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? d.textContent.slice(0, 90) : null;
    });
    // cancel the modal
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')].find(b => /انصراف|لغو/.test(b.textContent));
      btn && btn.click();
    });
    await page.waitForTimeout(500);
  } else r.weekModal = null;

  // ── day view: empty-hour strip ──
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-tour="cal-views"] button')];
    if (btns[2]) btns[2].click(); // روز
  });
  await page.waitForTimeout(1200);
  r.emptyHours = await page.evaluate(() => document.querySelectorAll("[data-empty-hour]").length);
  if (r.emptyHours > 0) {
    await page.evaluate((mid) => {
      const chip = document.querySelector(`[data-mid="${mid}"]`);
      if (!chip) return;
      const dt = new DataTransfer();
      chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, mid);
    await page.waitForTimeout(400);
    await page.evaluate((mid) => {
      const cell = document.querySelector("[data-empty-hour='16']");
      const d2 = new DataTransfer();
      d2.setData("text/plain", mid);
      cell.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d2 }));
      cell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    }, mid);
    await page.waitForTimeout(600);
    r.dayModal = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? d.textContent.includes("جابه‌جایی") : false;
    });
  } else r.dayModal = false;

  console.log(JSON.stringify(r, null, 1));
  const ok = r.weekCells > 20 && r.weekModal && r.emptyHours === 13 && r.dayModal;
  console.log(ok ? "WEEK+DAY DND ✅" : "CHECK ❌");
  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, { headers: { "Content-Type": "application/json" }, data: { reason: "OTHER" } }).catch(() => {});
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 250)));
