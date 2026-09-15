// E2E: edge-dock month picker — drag chip to LEFT edge → month panel → drop on a future month
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
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // meeting in the current month view
  const uniq = Date.now() % 100000;
  const start = new Date(Date.now() + 3 * 86400000);
  start.setUTCHours(11, 0, 0, 0);
  let created, mid;
  for (const room of ROOMS) {
    created = await page.request.post("http://127.0.0.1:3100/api/meetings", {
      headers: { "Content-Type": "application/json" },
      data: {
        title: `پنل ماه ${uniq}`,
        branchId: "branch-niavaran",
        roomId: room,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 3600000).toISOString(),
        meetingType: "INTERNAL",
        participantIds: [],
      },
    });
    if (created.status() === 201) break;
  }
  mid = (await created.json())?.data?.meeting?.id;
  const orig = (await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json())?.data?.meeting?.startAt;

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(500); }

  // drag: chip → hover LEFT edge dock → panel opens → drop on +2 months tile
  // start drag, then WAIT for the animated dock to mount before hovering it
  const chipOk = await page.evaluate((mid) => {
    const chip = document.querySelector(`[data-mid="${mid}"]`);
    if (!chip) return false;
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  }, mid);
  await page.waitForTimeout(900);
  const dockFound = await page.evaluate(() => !!document.querySelector('div[title="ماه‌های بعد"]'));
  const flow = { chip: chipOk, dock: dockFound };
  if (dockFound) {
    await page.evaluate(() => {
      const dock = document.querySelector('div[title="ماه‌های بعد"]');
      const dt = new DataTransfer();
      dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
      dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
  }

  const panel = await page.evaluate(() => {
    const p = [...document.querySelectorAll("div")].find(
      (d) => d.textContent.includes("انتقال به ماه‌های بعد") && d.className.toString().includes("w-56"),
    );
    if (!p) return { open: false };
    const tiles = [...p.querySelectorAll("div.grid > div")];
    return { open: true, tiles: tiles.length, labels: tiles.map((t) => t.textContent.trim().split("\n")[0]).join(",") };
  });
  console.log("flow:", JSON.stringify(flow), "| panel:", JSON.stringify(panel));

  let moved = null;
  if (panel.open) {
    // drop on the +2 month tile (second tile)
    const dropped = await page.evaluate((mid) => {
      const p = [...document.querySelectorAll("div")].find(
        (d) => d.textContent.includes("انتقال به ماه‌های بعد") && d.className.toString().includes("w-56"),
      );
      const tiles = [...p.querySelectorAll("div.grid > div")];
      const tile = tiles[1]; // +2 months
      const dt = new DataTransfer();
      dt.setData("text/plain", mid);
      tile.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      return true;
    }, mid);
    await page.waitForTimeout(1000);
    const modal = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return dlg ? { visible: true, text: dlg.textContent.replace(/\s+/g, " ").slice(0, 120) } : { visible: false };
    });
    console.log("modal:", modal.text ?? "none");
    if (modal.visible) {
      await page.locator('button:has-text("تأیید جابه‌جایی")').last().click();
      await page.waitForTimeout(2200);
      moved = (await (await page.request.get(`http://127.0.0.1:3100/api/meetings/${mid}`)).json())?.data?.meeting?.startAt;
    }
  }

  const o = new Date(orig);
  const nw = moved ? new Date(moved) : null;
  const dayDiff = nw ? Math.round((nw - o) / 86400000) : 0;
  const ok = panel.open && panel.tiles === 6 && nw && dayDiff >= 55 && dayDiff <= 68; // ~2 Jalali months
  console.log(`Δ${dayDiff}d`, ok ? "EDGE-DOCK MONTH DROP WORKS ✅" : "FAILED ❌");

  await page.request.post(`http://127.0.0.1:3100/api/meetings/${mid}/cancel`, {
    headers: { "Content-Type": "application/json" },
    data: { reason: "OTHER" },
  }).catch(() => {});
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("ERR", String(e).slice(0, 150)); process.exit(1); });
