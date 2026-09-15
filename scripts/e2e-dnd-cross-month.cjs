// E2E: drag a chip → hold edge (auto-advance 2 months) → drop on a day cell → modal + confirm works
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

  // create a meeting in a FREE room
  const ROOMS = ["room-a", "room-b", "room-c", "room-d", "room-m-beta"];
  const start = new Date(Date.now() + 3 * 86400000); start.setUTCHours(11, 0, 0, 0);
  let mid;
  for (const room of ROOMS) {
    const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
      headers: { "Content-Type": "application/json" },
      data: { title: "اتو دراپ " + (Date.now() % 100000), branchId: "branch-niavaran", roomId: room, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), meetingType: "INTERNAL", participantIds: [] },
    });
    if (created.status() === 201) { mid = (await created.json())?.data?.meeting?.id; break; }
  }
  if (!mid) { console.log("CREATE FAIL"); process.exit(1); }

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(400); }

  // 1) start drag
  const chipOk = await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    if (!chip) return false;
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  }, mid);
  await page.waitForTimeout(900); // docks mount

  // 2) hold the NEXT edge ~2.1s → auto-advance should flip ~2-3 months
  const headerBefore = await page.evaluate(() => {
    return [...document.querySelectorAll("h2, h3, [class*=font-bold]")].map(e => e.textContent.trim()).find(t => /۱۴۰۵|1405/.test(t)) || "";
  });
  await page.evaluate(() => {
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    const dt = new DataTransfer();
    dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
    dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await page.waitForTimeout(2100); // 600ms first flip + ~2 more at 700ms

  // 3) leave the dock (stop advancing) and drop on a real day cell of THIS month
  const result = await page.evaluate((mid) => {
    const header = [...document.querySelectorAll("h2, h3, [class*=font-bold]")].map(e => e.textContent.trim()).find(t => /۱۴۰۵|1405/.test(t)) || "";
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    const dtl = new DataTransfer();
    dock.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, relatedTarget: document.body }));
    const wrap = document.querySelector("[data-cal-wrap]");
    const grid = wrap ? wrap.querySelector("div.grid") : null;
    const cells = grid ? [...grid.querySelectorAll("button")].filter(b => /[۰-۹]/.test(b.textContent.trim().slice(0, 4))) : [];
    // a mid-month same-month cell (avoid other-month)
    const cell = cells[Math.floor(cells.length / 2)];
    if (!cell) return { header, cell: false };
    const d2 = new DataTransfer();
    d2.setData("text/plain", mid);
    cell.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    cell.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    return { header, cell: cell.textContent.trim().slice(0, 6) };
  }, mid);
  await page.waitForTimeout(600);

  // 4) modal should show; confirm it
  const modalShown = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? d.textContent.slice(0, 110) : null;
  });
  let confirmed = false;
  if (modalShown) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')].find(b => /تأیید|ثبت|انتقال/.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForTimeout(2500);
  }
  // 5) verify the meeting actually moved (startAt month != original)
  const after = await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json();
  const newStart = after?.data?.meeting?.startAt;
  const origMonth = start.toISOString().slice(0, 7);
  const newMonth = newStart ? newStart.slice(0, 7) : "?";
  console.log(JSON.stringify({ chipOk, headerBefore, headerAfter: result.header, cell: result.cell, modal: modalShown, origMonth, newMonth }, null, 1));
  const moved = newMonth !== origMonth && newMonth !== "?";
  console.log(moved ? "CROSS-MONTH CELL DROP WORKS ✅" : "DROP FAILED ❌");

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, { headers: { "Content-Type": "application/json" }, data: { reason: "OTHER" } }).catch(() => {});
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
