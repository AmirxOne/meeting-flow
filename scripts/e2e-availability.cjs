// E2E: availability finder — pick people, search free slots
const { BASE, login, dismissTour, safeClick, gotoApp, launchBrowser, finish } = require("./e2e-lib.cjs");

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  const { userId } = await login(page, "admin@example.com");
  await gotoApp(page, "/availability", userId);

  await page.locator("h1:has-text('یافتن زمان مناسب')").waitFor({ timeout: 30000 });
  check("availability page heading", true);

  await page.locator('button[aria-haspopup="listbox"]').first().waitFor({ timeout: 30000 });

  // branch: شعبه نیاوران (first Select on page)
  await safeClick(page, page.locator('button[aria-haspopup="listbox"]').nth(0));
  await page.waitForTimeout(400);
  await dismissTour(page);
  await page.evaluate(() => {
    const item = [...document.querySelectorAll('ul[role="listbox"] li')].find((li) =>
      li.textContent.includes("نیاوران"),
    );
    item?.click();
  });
  await page.waitForTimeout(500);
  const branchBtn = await page.locator('button[aria-haspopup="listbox"]').first().textContent();
  check(`branch selected (${branchBtn?.trim()})`, (branchBtn ?? "").includes("نیاوران"));
  if (!(branchBtn ?? "").includes("نیاوران")) throw new Error("branch not selected");

  // PeoplePicker: امیر + علی
  await dismissTour(page);
  for (const term of ["امیر", "علی"]) {
    await dismissTour(page);
    await safeClick(page, page.locator("div.min-h-11").first());
    const peopleInput = page.locator("div.min-h-11 input").first();
    await peopleInput.fill(term);
    await page.waitForTimeout(900);
    await page.locator('[data-idx="0"]').first().click();
    await page.waitForTimeout(500);
  }
  const peopleLabel = await page.locator('label:has-text("افراد")').textContent();
  check(`two people picked (${peopleLabel?.trim()})`, (peopleLabel ?? "").includes("۲"));

  await safeClick(page, page.locator('button:has-text("جستجوی زمان‌های آزاد")'));
  await Promise.race([
    page.locator("text=پیشنهادهای مناسب").waitFor({ timeout: 30000 }),
    page.locator("text=زمان مشترکی پیدا نشد").waitFor({ timeout: 30000 }),
  ]).catch(() => {});

  const suggestions = await page.locator("text=پیشنهادهای مناسب").count();
  const empty = await page.locator("text=زمان مشترکی پیدا نشد").count();
  check(`slot search result (suggestions=${suggestions}, empty=${empty})`, suggestions >= 1 || empty >= 1);

  if (suggestions >= 1) {
    const slotRows = await page.locator("text=همه افراد آزاد هستند").count();
    check(`slot suggestions listed (${slotRows})`, slotRows >= 1);
    const reserveLink = await page.locator('a:has-text("رزرو با این زمان")').count();
    check("reserve link on slot", reserveLink >= 1);
  }

  await finish(results, browser);
})();
