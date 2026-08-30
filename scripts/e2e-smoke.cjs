// Playwright smoke test against the live dev server using system Chrome.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);

  try {
    // 1. login page renders in Persian RTL
    await page.goto("http://localhost:3100/login", { waitUntil: "networkidle" });
    check("login page title فارسی", (await page.title()).includes("مهرسا"));
    check("dir=rtl", await page.getAttribute("html", "dir") === "rtl");

    // 2. login with admin
    await page.fill('input[name="identifier"]', "admin@example.com");
    await page.fill('input[type="password"]', "Pass1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    check("redirected to dashboard", page.url().includes("/dashboard"));

    // 3. dashboard shows stats
    await page.waitForSelector("text=جلسات امروز", { timeout: 20000 });
    check("dashboard stats visible", true);

    // 4. meetings list
    await page.goto("http://localhost:3100/meetings", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const meetingCount = await page.locator('a[href^="/meetings/"]:not([href$="/new"])').count();
    check("meetings list has items", meetingCount > 0);

    // 5. open a seeded meeting detail directly
    await page.goto("http://localhost:3100/meetings/seed-meeting-1", { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 20000 });
    const body = await page.textContent("body");
    check(
      "meeting detail + history",
      body.includes("جزئیات جلسه") && body.includes("تاریخچه جلسه") && body.includes("جلسه هفتگی تیم فروش"),
    );
    await page.screenshot({ path: "D:/meetinghub/e2e-meeting-detail.png" });

    // 6. calendar renders Jalali
    await page.goto("http://localhost:3100/calendar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const hasJalaliMonth = await page.locator("text=شهریور").count();
    check("calendar shows Jalali month (شهریور)", hasJalaliMonth > 0);

    // 7. rooms dashboard
    await page.goto("http://localhost:3100/rooms", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const roomCount = await page.locator('a[href^="/rooms/"]').count();
    check("rooms page lists rooms", roomCount >= 4);

    // 8. new meeting wizard
    await page.goto("http://localhost:3100/meetings/new", { waitUntil: "networkidle" });
    check("new meeting form", (await page.locator("text=اطلاعات جلسه").count()) > 0);

    // 9. availability page
    await page.goto("http://localhost:3100/availability", { waitUntil: "networkidle" });
    check("availability page", (await page.locator("text=یافتن زمان مناسب").count()) > 0);

    // 10. notifications
    await page.goto("http://localhost:3100/notifications", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    check("notifications page renders", (await page.locator("text=اعلان").count()) > 0);

    // 11. reports (admin has permission)
    await page.goto("http://localhost:3100/reports", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    check("reports page", (await page.locator("text=گزارش‌ها").count()) > 0);

    // 12. admin pages
    await page.goto("http://localhost:3100/admin/users", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("admin users", (await page.locator("text=مدیریت کاربران").count()) > 0);

    // screenshots
    await page.goto("http://localhost:3100/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "D:/meetinghub/e2e-dashboard.png", fullPage: false });
    await page.goto("http://localhost:3100/calendar", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "D:/meetinghub/e2e-calendar.png", fullPage: false });
    await page.goto("http://localhost:3100/meetings", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "D:/meetinghub/e2e-meetings.png", fullPage: false });
    check("screenshots saved", true);

    // 13. profile self-service (ali): change password → re-login → restore seed
    const BASE = "http://localhost:3100";
    const SEED_PASS = "Pass1234";
    const TEMP_PASS = "Pass5678";

    const aliLogin = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: "ali@example.com", password: SEED_PASS },
    });
    check("ali login for profile test", aliLogin.status() === 200);
    const aliCookie = (await aliLogin.headersArray()).find((h) => h.name === "set-cookie")?.value.split(";")[0] ?? "";
    const [aliCookieName, aliCookieValue] = aliCookie.split("=");
    await page.context().addCookies([{
      name: aliCookieName,
      value: aliCookieValue,
      domain: "localhost",
      path: "/",
    }]);
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=پروفایل من", { timeout: 20000 });
    check("profile page renders", (await page.locator("h1:has-text('پروفایل من')").count()) === 1);

    const changeRes = await page.request.post(`${BASE}/api/auth/change-password`, {
      headers: { Cookie: aliCookie },
      data: { currentPassword: SEED_PASS, newPassword: TEMP_PASS },
    });
    check("change-password API success", changeRes.status() === 200);

    const relogin = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: "ali@example.com", password: TEMP_PASS },
    });
    check("login with new password", relogin.status() === 200);

    const adminLogin = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: "admin@example.com", password: SEED_PASS },
    });
    const adminCookieHdr = (await adminLogin.headersArray()).find((h) => h.name === "set-cookie")?.value.split(";")[0] ?? "";
    const usersRes = await page.request.get(`${BASE}/api/users?q=ali`, { headers: { Cookie: adminCookieHdr } });
    const usersBody = await usersRes.json();
    const ali = usersBody?.data?.users?.find((u) => u.email === "ali@example.com");
    const restore = await page.request.post(`${BASE}/api/users/${ali?.id}/reset-password`, {
      headers: { Cookie: adminCookieHdr },
      data: { password: SEED_PASS },
    });
    check("restore ali seed password", restore.status() === 200);

  } catch (e) {
    results.push(["FATAL: " + e.message.split("\n")[0], false]);
  }

  await browser.close();

  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? "✅" : "❌"} ${name}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
})();
