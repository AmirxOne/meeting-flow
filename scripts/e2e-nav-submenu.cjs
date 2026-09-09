// E2E: sidebar submenus — expand/collapse (animated) + child links navigate
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const res = await page.request.post("http://127.0.0.1:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) { console.log("login:", res.status()); process.exit(1); }
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  await page.context().addInitScript(() => {
    // pre-seen all tours so nothing auto-opens
    try {
      const me = JSON.parse(localStorage.getItem("mehrsa-auth") || "{}");
      const uid = me?.state?.me?.id ?? "*";
      localStorage.setItem("nextstep-seen:" + uid, JSON.stringify(["dashboard","calendar","meetings-list","admin","meeting-detail","meetings-new","admin-settings","admin-policies","admin-roles","people","rooms","reports","notifications","users","profile","branches","availability","admin-users","admin-people","admin-audit-logs"]));
    } catch {}
  });
  await page.goto("http://127.0.0.1:3100/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2200);
  // dismiss any auto-started tour
  const closeBtn = page.locator('[aria-label="بستن"]').first();
  if (await closeBtn.count()) { await closeBtn.click().catch(() => {}); await page.waitForTimeout(700); }
  const overlay = page.locator('[data-name="nextstep-overlay"]');
  if (await overlay.count()) {
    await page.evaluate(() => window.__resetTours?.());
    await page.evaluate(() => document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((e) => e.remove()));
  }

  const results = [];
  const check = (name, ok) => { results.push([name, !!ok]); console.log((ok ? "PASS" : "FAIL") + " | " + name); };

  // 1. مدیریت parent has an expand button
  const adminToggle = page.locator('aside button[aria-label*="مدیریت"]').first();
  check("مدیریت has expand toggle", (await adminToggle.count()) >= 1);

  // 2. click to expand — submenu animates in (mid-animation height sampled)
  await adminToggle.click();
  const h = await page.evaluate(() => {
    const el = [...document.querySelectorAll("aside a[href='/admin/settings']")][0];
    return el ? Math.round(el.getBoundingClientRect().height) : -1;
  });
  check("sub items rendered after expand", h > 10);

  // 3. mid-animation: the wrapper height grows (animate height auto)
  const heights = [];
  await adminToggle.click(); // close first
  await page.waitForTimeout(300);
  await adminToggle.click(); // reopen and sample quickly
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(30);
    const hh = await page.evaluate(() => {
      const wrappers = [...document.querySelectorAll("aside div")].filter(
        (d) => d.className.toString().includes("overflow-hidden"),
      );
      return wrappers.length ? Math.round(wrappers[wrappers.length - 1].getBoundingClientRect().height) : -1;
    });
    heights.push(hh);
  }
  const distinctH = new Set(heights.filter((x) => x > 0)).size;
  check("expansion is animated (multiple heights: " + heights.join(",") + ")", distinctH >= 2);

  // 4. child link navigates directly
  await page.locator('aside a[href="/admin/settings"]').first().click();
  await page.waitForTimeout(1800);
  check("child link navigates to /admin/settings", page.url().includes("/admin/settings"));

  // 5. submenu auto-expanded because we are inside مدیریت
  const visible = await page.locator('aside a[href="/admin/settings"]').first().isVisible();
  check("submenu auto-expanded inside section", visible);

  // 6. جلسات parent → جلسه جدید child
  await page.locator('aside button[aria-label*="جلسات"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const newLink = await page.locator('aside a[href="/meetings/new"]').first().isVisible().catch(() => false);
  check("جلسات → جلسه جدید child visible", newLink);

  // 7. no duplicate top-level items pointing at admin children
  const dupTop = await page.evaluate(() => {
    // top-level items = direct children links of the items container (not inside the animated submenu wrapper)
    const nav = document.querySelector('aside nav');
    const topLinks = [...nav.querySelectorAll(':scope > div > div > a[href^="/admin"]')];
    return topLinks.filter((a) => a.getAttribute('href') !== '/admin').length;
  });
  check("no duplicate top-level admin links", dupTop === 0);

  let pass = 0;
  for (const [, ok] of results) if (ok) pass++;
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
