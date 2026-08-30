// E2E: people directory — /people (employee) + /admin/people (admin) CRUD flows
const { chromium } = require("playwright");

async function login(page, email) {
  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email, password: "Pass1234" },
  });
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [n, v] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: n.trim(), value: v.trim(), domain: "localhost", path: "/" }]);
  const meRes = await page.request.get("http://localhost:3100/api/auth/me", {
    headers: { cookie: `${n.trim()}=${v.trim()}` },
  });
  const meBody = await meRes.json();
  const userId = meBody.user?.id;
  if (userId) {
    await page.evaluate((uid) => {
      const tours = [
        "dashboard", "calendar", "meetings-list", "admin", "people", "rooms",
        "availability", "reports", "notifications", "branches", "users",
      ];
      localStorage.setItem(`nextstep-seen:${uid}`, JSON.stringify(tours));
    }, userId);
  }
  await page.evaluate(() => {
    const tours = [
      "dashboard", "calendar", "meetings-list", "admin", "people", "rooms",
      "availability", "reports", "notifications", "branches", "users",
    ];
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith("nextstep-seen:"))) {
      localStorage.setItem(key, JSON.stringify(tours));
    }
  });
}

async function dismissTour(page) {
  await page.waitForTimeout(1600);
  for (let i = 0; i < 10; i++) {
    if ((await page.locator('[data-name="nextstep-overlay"]').count()) === 0) return;
    await page.evaluate(() => {
      document.querySelector('[aria-label="بستن"]')?.click();
    });
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-name^="nextstep-"]').forEach((el) => el.remove());
  });
  await page.waitForTimeout(300);
}

async function runCrudFlow(page, path, prefix, uniq, check) {
  await page.goto(`http://localhost:3100${path}`, { waitUntil: "domcontentloaded" });
  await dismissTour(page);
  await page.locator("text=عضو شرکت").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  const cards = await page.locator("text=عضو شرکت").count();
  check(`${prefix}: directory renders (${cards} internal badges)`, cards >= 5);

  await dismissTour(page);
  await page.locator('button[aria-haspopup="listbox"]', { hasText: "نوع" }).first().click();
  await page.waitForTimeout(500);
  await page.locator('ul[role="listbox"] li', { hasText: "افراد خارجی" }).first().click();
  await page.waitForTimeout(1200);
  const externalBadges = await page.locator('span:has-text("خارجی")').count();
  check(`${prefix}: kind filter applied (external: ${externalBadges})`, externalBadges >= 2);

  await page.locator('button[aria-haspopup="listbox"]', { hasText: "نوع" }).first().click();
  await page.waitForTimeout(500);
  await page.locator('ul[role="listbox"] li', { hasText: "همه" }).first().click();
  await page.waitForTimeout(1000);

  await page.locator('button:has-text("فرد جدید")').click();
  const dlg = page.locator('[role="dialog"]');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('input[placeholder*="نام و نام خانوادگی"]').fill(`${uniq} زائر تستی`);
  await dlg.locator('input[placeholder*="شرکت"]').fill("شرکت تست الف");
  await dlg.locator('button:has-text("افزودن")').last().click();
  await page.waitForTimeout(1500);
  const added = await page.locator("tbody tr", { hasText: `${uniq} زائر تستی` }).count();
  check(`${prefix}: new person added`, added >= 1);

  {
    const row = page.locator("tbody tr", { hasText: `${uniq} زائر تستی` }).first();
    await row.waitFor({ timeout: 15000 });
    await row.locator('button[title="ویرایش"]').click();
  }
  const editDlg = page.locator('[role="dialog"]');
  await editDlg.waitFor({ timeout: 15000 });
  await editDlg.locator('input[placeholder*="نام و نام خانوادگی"]').fill(`${uniq} renamed`);
  await editDlg.locator('button:has-text("ذخیره تغییرات")').last().click();
  await page.waitForTimeout(3000);
  const edited = await page.locator("tbody tr", { hasText: `${uniq} renamed` }).count();
  check(`${prefix}: person edited (renamed)`, edited >= 1);

  page.once("dialog", (d) => d.accept());
  {
    const row = page.locator("tbody tr", { hasText: `${uniq} renamed` }).first();
    await row.waitFor({ timeout: 15000 });
    await row.locator('button[title="حذف"]').click();
  }
  await page.waitForTimeout(2000);
  const gone = await page.locator("tbody tr", { hasText: `${uniq} renamed` }).count();
  check(`${prefix}: person deleted`, gone === 0);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const UNIQ = Date.now() % 100000;
  const ADMIN_UNIQ = (Date.now() % 100000) + 1;
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  // --- /people as employee ---
  await login(page, "ali@example.com");
  await runCrudFlow(page, "/people", "employee /people", UNIQ, check);

  await page.goto("http://localhost:3100/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const navLink = await page.locator('a[href="/people"]').count();
  check(`employee sidebar افراد link present (${navLink})`, navLink >= 1);

  // --- /admin/people as admin ---
  await login(page, "admin@example.com");
  await runCrudFlow(page, "/admin/people", "admin /admin/people", ADMIN_UNIQ, check);

  await page.goto("http://localhost:3100/admin/people", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const adminHeading = await page.locator("text=مدیریت دایرکتوری افراد").count();
  check("admin page shows admin heading", adminHeading >= 1);

  const rowCol = await page.locator("th", { hasText: "ردیف" }).count();
  check("admin page has paginated table (ردیف column)", rowCol >= 1);

  // employee blocked on admin route
  await login(page, "ali@example.com");
  await page.goto("http://localhost:3100/admin/people", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const forbidden = await page.locator("text=نیازمند دسترسی").count();
  check("employee blocked on /admin/people", forbidden >= 1);

  let pass = 0;
  for (const [nm, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${nm}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
