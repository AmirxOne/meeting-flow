// E2E: door-display toggle in admin settings gates the room display board
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
  const cookie = `${n}=${v}`;
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  const checks = {};

  // 1) settings page shows the toggle, currently ON
  await page.goto("http://127.0.0.1:3100/admin/settings", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  checks.toggleVisible = await page.locator('button[role="switch"][aria-label*="نمایشگر"]').isVisible().catch(() => false);
  checks.initiallyOn = (await page.locator('button[role="switch"][aria-label*="نمایشگر"]').getAttribute("aria-checked")) === "true";

  // 2) display board API responds normally while ON (room-c or any)
  const onRes = await fetch("http://127.0.0.1:3100/api/rooms/room-c/display", { headers: { cookie } });
  checks.apiWhileOn = onRes.status === 200;

  // 3) flip the switch OFF
  await page.evaluate(() => { document.querySelector('button[role="switch"][aria-label*="نمایشگر"]').click(); });
  await page.waitForTimeout(1500);
  checks.afterOff = (await page.locator('button[role="switch"][aria-label*="نمایشگر"]').getAttribute("aria-checked")) === "false";

  // 4) display API now refuses with DISPLAY_DISABLED
  const offRes = await fetch("http://127.0.0.1:3100/api/rooms/room-c/display", { headers: { cookie } });
  const offJ = await offRes.json().catch(() => ({}));
  checks.apiWhileOff = offRes.status === 403 && offJ?.error?.code === "DISPLAY_DISABLED";

  // 5) kiosk page shows the disabled screen
  await page.goto("http://127.0.0.1:3100/rooms/room-c/display", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  checks.disabledScreen = await page.evaluate(() => document.body.innerText.includes("غیرفعال است"));

  // 6) turn back ON (restore)
  await page.goto("http://127.0.0.1:3100/admin/settings", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { document.querySelector('button[role="switch"][aria-label*="نمایشگر"]').click(); });
  await page.waitForTimeout(1200);
  const restored = (await page.locator('button[role="switch"][aria-label*="نمایشگر"]').getAttribute("aria-checked")) === "true";
  const resRes = await fetch("http://127.0.0.1:3100/api/rooms/room-c/display", { headers: { cookie } });
  checks.restored = restored && resRes.status === 200;

  console.log(JSON.stringify(checks, null, 1));
  console.log(Object.values(checks).every(Boolean) ? "DISPLAY TOGGLE FULL ✅" : "SOME FAILED ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
