// E2E: employee vs admin see a coherent world: employee gets guided away from /meetings/new;
// admin sees «ثبت مستقیم جلسه» under مدیریت only
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ── employee (ali) ──
  const rl = await fetch("http://127.0.0.1:3100/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ali@example.com", password: "Pass1234" }),
  });
  for (const c of rl.headers.getSetCookie()) {
    const p = c.split(";")[0]; const eq = p.indexOf("=");
    await ctx.addCookies([{ name: p.slice(0, eq), value: p.slice(eq + 1), domain: "127.0.0.1", path: "/" }]);
  }

  await page.goto("http://127.0.0.1:3100/meetings/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  const emp = await page.evaluate(() => ({
    guided: document.body.innerText.includes("اینجا مخصوص مدیریت است"),
    cta: !!document.querySelector('a[href="/meeting-requests"]'),
  }));

  // sidebar: employee must NOT see «ثبت مستقیم جلسه»
  await page.goto("http://127.0.0.1:3100/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  emp.noDirectInSidebar = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    return aside ? !aside.textContent.includes("ثبت مستقیم جلسه") : true;
  });

  // ── admin ──
  await ctx.clearCookies();
  const ra = await fetch("http://127.0.0.1:3100/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "Pass1234" }),
  });
  for (const c of ra.headers.getSetCookie()) {
    const p = c.split(";")[0]; const eq = p.indexOf("=");
    await ctx.addCookies([{ name: p.slice(0, eq), value: p.slice(eq + 1), domain: "127.0.0.1", path: "/" }]);
  }

  await page.goto("http://127.0.0.1:3100/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const adm = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href="/meetings/new"]')];
    return { directInSidebar: links.some((l) => l.offsetParent !== null) };
  });

  await page.goto("http://127.0.0.1:3100/meetings/new", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  adm.formOpen = await page.evaluate(() => document.body.innerText.includes("ثبت مستقیم جلسه"));

  console.log(JSON.stringify({ emp, adm }, null, 1));
  const ok = emp.guided && emp.cta && emp.noDirectInSidebar && adm.directInSidebar && adm.formOpen;
  console.log(ok ? "COHERENT MODEL ✅" : "MISMATCH ❌");
  await browser.close();
})().catch((e) => console.log("ERR", String(e).slice(0, 200)));
