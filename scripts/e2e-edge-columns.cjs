// E2E: Saturday & Friday columns are droppable (not blocked by edge docks)
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

  // create a meeting at a free hour today+2d
  const hrs = [8, 10, 12, 14, 16, 18];
  const h = hrs[Date.now() % hrs.length];
  const start = new Date(Date.now() + 4 * 86400000); start.setUTCHours(h, 0, 0, 0);
  const uniq = Date.now() % 100000;
  const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: { title: "ستون تست " + uniq, branchId: "branch-niavaran", roomId: "room-c", startAt: start.toISOString(), endAt: new Date(start.getTime() + 3600000).toISOString(), meetingType: "INTERNAL", participantIds: [] },
  });
  const mid = (await created.json())?.data?.meeting?.id;
  if (!mid) { console.log('CREATE FAIL', created.status(), JSON.stringify(await created.json()).slice(0,150)); process.exit(1); }

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(400); }

  // start drag then dispatch drop directly onto the FIRST cell (Saturday col) and LAST cell (Friday col)
  const result = await page.evaluate(async (mid) => {
    const chip = document.querySelector(`a[href="/meetings/${mid}"]`);
    if (!chip) return { step: "chip" };
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 150));

    const wrap = document.querySelector("div.relative.overflow-hidden");
    const grid = wrap ? wrap.querySelector("div.grid") : null;
    if (!wrap || !grid) return { step: 'no-wrap-or-grid', wrap: !!wrap };
    const cells = [...grid.querySelectorAll("button")].filter((b) => /[۰-۹]/.test(b.textContent.trim().slice(0, 4)));
    const sat = cells[0]; // first cell = Saturday of week 1 (RTL rightmost col)
    if (cells.length < 28) return { step: "cells", n: cells.length };
    const friday = cells[cells.length - 1]; // last cell = Friday of last week (leftmost col)
    const tryDrop = (el) => {
      const d2 = new DataTransfer();
      d2.setData("text/plain", mid);
      el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d2 }));
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: d2 }));
    };
    // dragOver first so React state (dragId) is fully committed, then drop
    const d0 = new DataTransfer();
    d0.setData("text/plain", mid);
    sat.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d0 }));
    await new Promise((r) => setTimeout(r, 120));
    tryDrop(sat);
    await new Promise((r) => setTimeout(r, 250));
    const satModal = !!document.querySelector('[role="dialog"]');
    const satModalText = satModal ? document.querySelector('[role="dialog"]').textContent.slice(0, 80) : "";
    // close modal (cancel button) and wait for it to unmount
    const cancelBtn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /انصراف|لغو/.test(b.textContent));
    if (cancelBtn) cancelBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    const gone = !document.querySelector('[role="dialog"]');
    const d1 = new DataTransfer();
    d1.setData("text/plain", mid);
    friday.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: d1 }));
    await new Promise((r) => setTimeout(r, 120));
    tryDrop(friday);
    await new Promise((r) => setTimeout(r, 250));
    const friModal = !!document.querySelector('[role="dialog"]');
    return {
      satCell: sat ? sat.textContent.trim().slice(0, 12) : null,
      friCell: friday ? friday.textContent.trim().slice(0, 12) : null,
      satModal, satModalText, friModal,
    };
  }, mid);
  console.log(JSON.stringify(result, null, 1));
  const ok = result.satModal && result.friModal;
  console.log(ok ? "SAT & FRI DROPPABLE ✅" : "DROPPABLE FAIL ❌");

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, { headers: { "Content-Type": "application/json" }, data: { reason: "OTHER" } }).catch(() => {});
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
