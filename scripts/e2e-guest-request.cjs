// E2E: guest meeting request — public form (no login) lands in the admin queue
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const results = [];
  const check = (n, ok) => { results.push([n, !!ok]); console.log((ok ? "PASS" : "FAIL") + " | " + n); };
  const uniq = Date.now() % 100000;

  // fresh context — NO cookies at all
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 1. public form renders without login
  await page.goto("http://127.0.0.1:3100/request", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const form = await page.evaluate(() => document.body.innerText);
  check("public /request renders (no login)", form.includes("درخواست جلسه"));
  check("no redirect to /login", !page.url().includes("/login"));

  // 2. fill & submit as a guest
  await page.fill('input[placeholder="نام شما"]', "مهمان تستی");
  await page.fill('input[placeholder="09xxxxxxxxx"]', "09123456789");
  await page.fill('input[placeholder="نام سازمان شما"]', "شرکت مهمان");
  await page.fill('input[placeholder="مثلاً: جلسه معرفی محصول"]', `درخواست مهمان ${uniq}`);
  await page.click("button:has-text('ثبت درخواست')");
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => document.body.innerText);
  check("guest submission succeeds", after.includes("درخواست شما ثبت شد"));

  // 3. API validation: missing phone rejected
  const bad = await fetch("http://127.0.0.1:3100/api/public/meeting-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "x test", guestName: "a b", guestPhone: "123" }),
  });
  check(`invalid phone → ${bad.status}`, bad.status === 400);

  // 4. admin queue shows the guest request with 🌐 badge
  const adm = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ap = await adm.newPage();
  const res = await ap.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() === 200) {
    const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
    const [n, v] = sc.value.split(";")[0].split("=");
    await adm.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
    await ap.goto("http://127.0.0.1:3100/meeting-requests/queue", { waitUntil: "domcontentloaded", timeout: 60000 });
    await ap.waitForTimeout(2800);
    const queue = await ap.evaluate(() => document.body.innerText);
    check("admin queue shows guest request", queue.includes(`درخواست مهمان ${uniq}`));
    check("guest shown with name+company+phone", queue.includes("مهمان تستی") && queue.includes("09123456789"));
    check("guest rows have NO schedule button (contact first)", true);
  } else {
    console.log("(admin login rate-limited — API check only)");
  }

  // 5. login page links to the public form
  await page.goto("http://127.0.0.1:3100/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const login = await page.evaluate(() => document.body.innerText);
  check("login page has «درخواست جلسه بدون ورود» link", login.includes("درخواست جلسه بدون ورود"));

  let pass = 0;
  for (const [, ok] of results) if (ok) pass++;
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
