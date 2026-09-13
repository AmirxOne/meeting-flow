// E2E: personal report (/reports/me) — employee sees own stats, not others'
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const results = [];
  const check = (n, ok) => { results.push([n, !!ok]); console.log((ok ? "PASS" : "FAIL") + " | " + n); };

  // ── employee: page renders with own data ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "ali@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);

  // API first
  const api = await page.request.get("http://127.0.0.1:3100/api/reports/me");
  const j = await api.json().catch(() => null);
  check(`employee → /api/reports/me → ${api.status}`, api.status() === 200);
  check("summary present", !!j?.data?.summary && typeof j.data.summary.totalMeetings === "number");
  check("topPeople array", Array.isArray(j?.data?.topPeople));

  // page
  await page.goto("http://127.0.0.1:3100/reports/me", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2800);
  const body = await page.evaluate(() => document.body.innerText);
  check("page renders «گزارش من»", body.includes("گزارش من"));
  check("stat cards visible", body.includes("مجموع ساعت جلسات") && body.includes("کل جلسات"));
  check("no error boundary", !body.includes("خطای غیرمنتظره"));
  // sidebar link exists for employee
  check("sidebar has «گزارش من»", body.includes("گزارش من"));
  // org reports hidden for employee
  check("sidebar hides «گزارش‌های سازمان» for employee", !body.includes("گزارش‌های سازمان"));

  // ── employee CANNOT see org-level /api/reports (403, already known) ──
  const org = await page.request.get("http://127.0.0.1:3100/api/reports");
  check(`org reports still restricted → ${org.status}`, org.status() === 403);

  // ── admin sees BOTH nav items and page works ──
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ap = await actx.newPage();
  const ares = await ap.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (ares.status() === 200) {
    const asc = (await ares.headersArray()).find((h) => h.name === "set-cookie");
    const [an, av] = asc.value.split(";")[0].split("=");
    await actx.addCookies([{ name: an.trim(), value: av.trim(), domain: "localhost", path: "/" }]);
    await ap.goto("http://127.0.0.1:3100/reports/me", { waitUntil: "domcontentloaded", timeout: 60000 });
    await ap.waitForTimeout(2500);
    const abody = await ap.evaluate(() => document.body.innerText);
    check("admin sees «گزارش من» page too", abody.includes("گزارش من"));
    check("admin sidebar shows org reports", abody.includes("گزارش‌های سازمان"));
  }

  let pass = 0;
  for (const [, ok] of results) if (ok) pass++;
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
