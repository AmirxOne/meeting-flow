// E2E: guided tours — first visit auto-starts, spotlight card renders, completes & doesn't re-show
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONS:', m.text().slice(0, 120)); });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  // fresh context = no localStorage → first visit
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "ali@example.com", password: "Pass1234" }, // employee
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // 1. dashboard → tour auto-starts (wait for the card)
  await page.goto("http://localhost:3100/dashboard", { waitUntil: "domcontentloaded" });
  const card = page.locator("text=خوش آمدید به مهرسا");
  await card.waitFor({ timeout: 15000 }).catch(() => {});
  check("first visit: dashboard tour auto-starts", (await card.count()) >= 1);

  // 2. spotlight card: has Persian counter + next button
  const counter = await page.locator("text=۱ از ۵").count();
  check("card shows «۱ از ۵» (Persian counter)", counter >= 1);

  // 3. click through all steps
  for (let i = 0; i < 4; i++) {
    const btn = page.locator("button:has-text('بعدی'), button:has-text('متوجه شدم')").last();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click();
    await page.waitForTimeout(600);
  }
  const done = await page.locator("button:has-text('متوجه شدم')").count();
  await page.locator("button:has-text('متوجه شدم')").last().click().catch(() => {});
  await page.waitForTimeout(800);
  const cardGone = (await page.locator("text=خوش آمدید").count()) === 0;
  check("tour completes and closes", cardGone);

  // 4. reload → tour must NOT re-appear (persisted)
  await page.goto("http://localhost:3100/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const reAppeared = await page.locator("text=خوش آمدید به مهرسا").count();
  check("second visit: tour does NOT re-show", reAppeared === 0);

  // 5. calendar tour auto-starts on first calendar visit
  await page.goto("http://localhost:3100/calendar", { waitUntil: "domcontentloaded" });
  const calCard = page.locator("text=تقویم مهرسا");
  await calCard.waitFor({ timeout: 15000 }).catch(() => {});
  check("calendar tour auto-starts (per-page)", (await calCard.count()) >= 1);
  // close it via X
  await page.locator('[aria-label="بستن"]').first().click().catch(() => {});
  await page.waitForTimeout(500);

  // 6. reset helper works (window.__resetTours) → tour can replay after reset
  await page.evaluate(() => (window).__resetTours?.());
  await page.goto("http://localhost:3100/dashboard", { waitUntil: "domcontentloaded" });
  const replay = page.locator("text=خوش آمدید به مهرسا");
  await replay.waitFor({ timeout: 15000 }).catch(() => {});
  check("after __resetTours: tour replays", (await replay.count()) >= 1);

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
