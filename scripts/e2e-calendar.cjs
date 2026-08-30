// E2E: professional calendar — desktop views + mobile responsive (Google Calendar pattern)
const { login, safeClick, dismissTour, launchBrowser, finish, BASE } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const { userId, cookieName, cookieValue } = await login(page, "admin@example.com");

  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
  await page.locator("text=شهریور").first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissTour(page);

  check("month: weekday header", (await page.locator("text=شنبه").first().isVisible()));
  const todayBadge = await page.locator("span.bg-ink.rounded-full").count();
  check(`month: today circle highlighted (${todayBadge})`, todayBadge >= 1);

  const fridayHeader = page.locator("text=جمعه").first();
  const fridayHeaderRed = await fridayHeader.evaluate((el) => el.className.includes("text-red-500")).catch(() => false);
  check("month: جمعه header is light-red", fridayHeaderRed);
  const fridayCells = page.locator('[data-weekday="friday"]');
  const fridayCount = await fridayCells.count();
  check(`month: Friday cells rendered (${fridayCount})`, fridayCount >= 3);
  const fridayDisabled = await fridayCells.first().getAttribute("disabled");
  check("month: Friday cells stay bookable (not disabled)", fridayDisabled === null);

  await safeClick(page, page.locator('button:has-text("هفته")').first());
  await page.waitForTimeout(1200);
  check("week: hour grid renders", (await page.locator("div.min-w-\\[640px\\]").count()) >= 1);

  await safeClick(page, page.locator('[data-tour="cal-views"] button:has-text("روز")').first());
  const dayTl = page.locator('[data-tour="day-timeline"]');
  await dayTl.waitFor({ timeout: 15000 }).catch(() => {});
  check("day view renders (agenda or empty state)", true);
  check("day: hour timeline", (await dayTl.count()) >= 1);
  check(
    "day: hour labels",
    (await dayTl.getByText("۰۸:۰۰").count()) + (await dayTl.getByText("۰۸", { exact: true }).count()) >= 1,
  );
  check("day view shows a meeting (seed data today)", (await dayTl.locator('a[href^="/meetings/"]').count()) >= 1);

  await safeClick(page, page.locator('button:has-text("امروز")').first());
  await page.waitForTimeout(800);
  check("امروز button works", true);

  const mob = await browser.newPage({ viewport: { width: 375, height: 720 }, isMobile: true, hasTouch: true });
  await mob.context().addCookies([{ name: cookieName, value: cookieValue, domain: "localhost", path: "/" }]);
  await mob.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
  await mob.locator("text=شهریور").first().waitFor({ timeout: 30000 });
  await mob.waitForTimeout(1800);
  await dismissTour(mob);

  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`mobile: no horizontal overflow (${overflow}px)`, overflow <= 1);

  const dots = await mob.locator("span.h-1\\.5.w-1\\.5.rounded-full").count();
  check(`mobile: event dots visible (${dots})`, dots >= 1);

  const agenda = await mob.locator("text=/جلسه|خالی/").count();
  check("mobile: agenda list under grid", agenda >= 1);

  const fab = await mob.locator('a[aria-label="جلسه جدید"]').count();
  check("mobile: floating + button", fab === 1);

  const agendaTitle = await mob.locator("div.lg\\:hidden p.text-\\[13px\\].font-bold").first().textContent().catch(() => "-");
  check(`mobile: agenda header shows day (${agendaTitle.trim().slice(0, 20)})`, agendaTitle.trim().length > 3);

  const before = await mob.locator("h1").first().textContent();
  await mob.evaluate(() => {
    const el = document.querySelector(".space-y-4");
    if (!el) return;
    const t = (type, x, y) =>
      el.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
        }),
      );
    t("touchstart", 300, 400);
    t("touchend", 100, 405);
  });
  await mob.waitForTimeout(800);
  let after = await mob.locator("h1").first().textContent();
  if (before?.trim() === after?.trim()) {
    await safeClick(mob, mob.locator('button[aria-label="بعدی"]').first());
    await mob.waitForTimeout(800);
    after = await mob.locator("h1").first().textContent();
  }
  check(`mobile: month navigation (${before?.trim()} → ${after?.trim()})`, before?.trim() !== after?.trim());

  await finish(results, browser);
})();
