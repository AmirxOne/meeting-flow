// E2E: drag & drop shows the CONFIRMATION MODAL (not window.confirm)
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => { console.log("NATIVE DIALOG SHOWN ❌:", d.message().slice(0, 60)); d.accept(); });

  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // meeting far in the future
  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() + 2 * 86400000); // within current month view
  start.setUTCHours(10, 0, 0, 0);
  const created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
    headers: { "Content-Type": "application/json" },
    data: {
      title: `درگ مودال ${uniq}`,
      branchId: "branch-niavaran",
      roomId: "room-c",
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 3600000).toISOString(),
      meetingType: "INTERNAL",
      participantIds: [],
    },
  });
  const mid = (await created.json())?.data?.meeting?.id;

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(500); }

  // find the chip's cell and a DIFFERENT day cell in the same month grid
  const cells = await page.evaluate((mid) => {
    const chip = document.querySelector(`a[href="/meetings/${mid}"]`);
    if (!chip) return { chip: false };
    const grid = chip.closest(".grid.grid-cols-7");
    const cellBtns = [...grid.querySelectorAll("button")];
    const srcIdx = cellBtns.indexOf(chip.closest("button"));
    // pick a cell ~5 days later in the grid
    const target = cellBtns[Math.min(srcIdx + 5, cellBtns.length - 1)];
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    chip.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    return { chip: true, srcIdx, targetIdx: cellBtns.indexOf(target) };
  }, mid);
  console.log("cells:", JSON.stringify(cells));
  await page.waitForTimeout(1200);

  // the MODAL should be visible
  const modal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { visible: false };
    const r = dlg.getBoundingClientRect();
    return { visible: r.width > 100, text: dlg.textContent.replace(/\s+/g, " ").slice(0, 130) };
  });
  console.log("modal:", JSON.stringify(modal));

  let confirmedToast = false;
  if (modal.visible) {
    await page.locator('button:has-text("تأیید جابه‌جایی")').last().click();
    await page.waitForTimeout(2200);
    confirmedToast = await page.evaluate(() => document.body.textContent.includes("جلسه جابه‌جا شد"));
  }

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});

  console.log(modal.visible ? "MODAL SHOWN ✅" : "MODAL MISSING ❌");
  console.log(confirmedToast ? "CONFIRM WORKS ✅" : "confirm toast missing");
  await browser.close();
  process.exit(modal.visible ? 0 : 1);
})().catch((e) => { console.log("ERR", String(e).slice(0, 150)); process.exit(1); });
