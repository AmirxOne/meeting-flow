// E2E: all admin-section pages render without the 500 error boundary, per role
const { chromium } = require("playwright");

const PAGES = [
  "/admin",
  "/admin/users",
  "/admin/rooms",
  "/admin/people",
  "/admin/policies",
  "/admin/roles",
  "/admin/settings",
  "/admin/audit-logs",
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  let total = 0, pass = 0;
  for (const email of ["admin@example.com", "superadmin@example.com"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
      data: { email, password: "Pass1234" },
    });
    if (res.status() !== 200) { console.log(email, "login:", res.status); await ctx.close(); continue; }
    const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
    const [n, v] = sc.value.split(";")[0].split("=");
    await ctx.addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
    const who = email.split("@")[0];
    for (const p of PAGES) {
      total++;
      try {
        await page.goto("http://127.0.0.1:3100" + p, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2200);
        const body = await page.evaluate(() => document.body.innerText);
        const has500 = body.includes("خطای غیرمنتظره");
        const ok = !has500;
        if (ok) pass++;
        console.log(`${ok ? "PASS" : "FAIL"} | ${who} ${p}`);
      } catch (e) {
        console.log(`FAIL | ${who} ${p} — ${String(e).split("\n")[0].slice(0, 50)}`);
      }
    }
    await ctx.close();
  }
  console.log(`\n${pass}/${total} passed`);
  await browser.close();
  process.exit(pass === total ? 0 : 1);
})();
