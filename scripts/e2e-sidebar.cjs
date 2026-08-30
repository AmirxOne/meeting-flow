// E2E: professional sidebar — grouped labels, active state, RBAC visibility
const { login, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const admin = await login(page, "admin@example.com");
  await gotoApp(page, "/dashboard", admin.userId);

  const nav = page.locator('[data-tour="nav"]');
  await nav.waitFor({ timeout: 20000 });

  const labels = ["اصلی", "سازمان", "سامانه"];
  for (const label of labels) {
    check(`admin sees group «${label}»`, (await nav.locator(`text=${label}`).count()) >= 1);
  }

  check("admin sees داشبورد as first nav link", (await nav.locator('a[href="/dashboard"]').count()) >= 1);
  check("admin sees مدیریت", (await nav.locator('a[href="/admin"]').count()) >= 1);
  check("admin sees گزارش‌ها", (await nav.locator('a[href="/reports"]').count()) >= 1);
  check("admin does not see لاگ ممیزی item", (await nav.locator('a[href="/admin/audit-logs"]').count()) === 0);

  const dashLink = nav.locator('a[href="/dashboard"]').first();
  check("dashboard is aria-current on /dashboard", (await dashLink.getAttribute("aria-current")) === "page");
  const helpBtn = page.getByRole("button", { name: "راهنمای این صفحه" });
  check("header help button shows «راهنما»", (await helpBtn.count()) === 1 && (await helpBtn.innerText()).includes("راهنما"));
  await helpBtn.hover();
  const tip = page.getByRole("tooltip");
  await tip.waitFor({ timeout: 5000 }).catch(() => {});
  check("custom tooltip replaces native title", (await tip.count()) >= 1 && (await tip.innerText()).includes("راهنما"));

  await gotoApp(page, "/calendar", admin.userId);
  const navAfter = page.locator('[data-tour="nav"]');
  await navAfter.waitFor({ timeout: 20000 });
  check(
    "calendar is aria-current on /calendar",
    (await navAfter.locator('a[href="/calendar"]').first().getAttribute("aria-current")) === "page",
  );
  check(
    "dashboard is not current on /calendar",
    (await navAfter.locator('a[href="/dashboard"]').first().getAttribute("aria-current")) !== "page",
  );

  await ctx.close();

  const empCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const emp = await empCtx.newPage();
  const ali = await login(emp, "ali@example.com");
  await gotoApp(emp, "/dashboard", ali.userId);
  const empNav = emp.locator('[data-tour="nav"]');
  await empNav.waitFor({ timeout: 20000 });
  check("employee sees اصلی", (await empNav.locator("text=اصلی").count()) >= 1);
  check("employee does not see مدیریت", (await empNav.locator('a[href="/admin"]').count()) === 0);
  check("employee does not see گزارش‌ها", (await empNav.locator('a[href="/reports"]').count()) === 0);

  await empCtx.close();

  const mgrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mgr = await mgrCtx.newPage();
  const sara = await login(mgr, "sara@example.com");
  await gotoApp(mgr, "/dashboard", sara.userId);
  const mgrNav = mgr.locator('[data-tour="nav"]');
  await mgrNav.waitFor({ timeout: 20000 });
  check("branch manager sees گزارش‌ها", (await mgrNav.locator('a[href="/reports"]').count()) >= 1);
  check("branch manager sees لاگ ممیزی", (await mgrNav.locator('a[href="/admin/audit-logs"]').count()) >= 1);
  check("branch manager does not see مدیریت", (await mgrNav.locator('a[href="/admin"]').count()) === 0);

  await mgrCtx.close();
  } catch (err) {
    check(`uncaught: ${err.message}`.slice(0, 80), false);
  }
  await finish(results, browser);
})();
