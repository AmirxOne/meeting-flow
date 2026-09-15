// E2E: dock robustness — sticky panel while hovering tiles, animated month flip, stable auto-advance
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

  await page.goto("http://127.0.0.1:3100/calendar", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const x = page.locator('[aria-label="بستن"]').first();
  if (await x.count()) { await x.click().catch(() => {}); await page.waitForTimeout(400); }

  // ---- A) sticky panel: open panel, then "travel" toward a tile and confirm panel survives 400ms ----
  // use any existing seed chip (seed places meetings relative to today)
  const mid = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('a[href^="/meetings/"]')].find(a => /^\/meetings\/[a-z0-9]{20,}$/i.test(a.getAttribute('href')));
    return chip ? chip.getAttribute('href').split('/').pop() : null;
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const xx = page.locator('[aria-label="بستن"]').first();
  if (await xx.count()) { await xx.click().catch(() => {}); await page.waitForTimeout(400); }
  await page.evaluate((mid) => {
    const chip = document.querySelector('a[href="/meetings/' + mid + '"]');
    if (!chip) throw new Error('chip not found for ' + mid);
    const dt = new DataTransfer();
    chip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, mid);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    const dt = new DataTransfer();
    dock.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
    dock.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await page.waitForTimeout(500);
  const open1 = await page.evaluate(() => !!document.querySelector(".grid.grid-cols-2.gap-1\\.5"));
  // now simulate moving from dock INTO the panel (leave dock → enter panel) — must NOT close
  await page.evaluate(() => {
    const dock = document.querySelector('div[title="ماه‌های بعد"]');
    const panel = document.querySelector(".grid.grid-cols-2.gap-1\\.5");
    const dt = new DataTransfer();
    dock.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, relatedTarget: panel }));
    panel.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true }));
    panel.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await page.waitForTimeout(500);
  const open2 = await page.evaluate(() => !!document.querySelector(".grid.grid-cols-2.gap-1\\.5"));
  console.log("panel after dock-open:", open1, "| after moving onto panel:", open2);
  console.log(open1 && open2 ? "STICKY PANEL ✅" : "PANEL DIES ❌");

  // ---- B) animated month flip (light) ----
  await page.waitForTimeout(600);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'بعدی')?.click(); });
  await page.waitForTimeout(120);
  const t1 = await page.evaluate(() => {
    const g = document.querySelector('.relative.overflow-hidden .grid');
    return g ? getComputedStyle(g).transform : 'none';
  });
  await page.waitForTimeout(320);
  const t2 = await page.evaluate(() => {
    const g = document.querySelector('.relative.overflow-hidden .grid');
    return g ? getComputedStyle(g).transform : 'none';
  });
  const animated = t1 !== 'none' || t2 !== 'none';
  console.log('mid-flip transform:', t1, '| after:', t2);
  console.log(animated ? 'ANIMATED FLIP ✅' : 'NO ANIMATION ❌');

  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
