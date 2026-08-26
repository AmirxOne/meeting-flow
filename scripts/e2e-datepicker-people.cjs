// E2E: Jalali DatePicker + PeoplePicker + people directory
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  await page.goto("http://localhost:3100/login", { waitUntil: "domcontentloaded" });
  const res = await page.request.post("http://localhost:3100/api/auth/login", {
    data: { email: "admin@example.com", password: "Pass1234" },
  });
  if (res.status() !== 200) throw new Error("login failed " + res.status());
  const sc = (await res.headersArray()).find((h) => h.name === "set-cookie");
  const [name, val] = sc.value.split(";")[0].split("=");
  await page.context().addCookies([{ name: name.trim(), value: val.trim(), domain: "localhost", path: "/" }]);

  // ── 1. admin/people page: directory listed ──
  await page.goto("http://localhost:3100/admin/people", { waitUntil: "domcontentloaded" });
  await page.locator("tbody tr").first().waitFor({ state: "visible", timeout: 30000 });
  const dirRows = await page.locator("tbody tr").count();
  check(`people directory shows ${dirRows} rows (11 seeded)`, dirRows >= 11);

  // ── 2. add new external person via form ──
  await page.click('button:has-text("فرد جدید")');
  await page.waitForTimeout(300);
  await page.fill('input[placeholder*="نام و نام خانوادگی"]', "آقای آزمون دیتای جدید");
  await page.fill('input[placeholder*="شرکت"]', "شرکت تستی پیکر");
  await page.click('button:has-text("ثبت فرد")');
  await page.waitForTimeout(1200);
  const addedVisible = await page.locator('td:has-text("آقای آزمون دیتای جدید")').count();
  check("new person added and listed", addedVisible >= 1);

  // ── 3. meetings/new: NO native date input, Jalali picker present ──
  await page.goto("http://localhost:3100/meetings/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const nativeDateInputs = await page.locator('input[type="date"]').count();
  check("no native date input", nativeDateInputs === 0);
  const anyDialogBtn = await page.locator('button[aria-haspopup="dialog"]').count();
  check(`jalali date picker trigger present (${anyDialogBtn})`, anyDialogBtn >= 1);
  const pickerBtn = page.locator('button[aria-haspopup="dialog"]').first();

  // open picker, verify Persian month header + today quick button
  await pickerBtn.click();
  await page.waitForTimeout(500);
  const monthHeader = await page.locator("div >> text=/فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند/").first().isVisible().catch(() => false);
  check("picker opens with Jalali month header", monthHeader);
  const todayBtn = await page.locator('button:has-text("امروز")').count();
  check("quick امروز button exists", todayBtn === 1);
  // pick today
  await page.locator('button:has-text("امروز")').click();
  await page.waitForTimeout(400);
  const triggerTxt = await page.locator('button[aria-haspopup="dialog"]').first().textContent();
  check(`trigger shows Jalali date (${triggerTxt.trim()})`, /[\u06F0-\u06F9]/.test(triggerTxt));
  await page.screenshot({ path: "D:/meetinghub/e2e-datepicker.png" });

  // ── 4. PeoplePicker: search, pick internal + type new external ──
  const peopleInput = page.locator('input[placeholder*="جستجو و انتخاب"]').first();
  await peopleInput.click();
  await page.waitForTimeout(2000);
  // directory dropdown with badges
  const memberBadge = await page.locator('span:has-text("عضو شرکت")').count();
  check(`directory dropdown shows عضو شرکت badges (${memberBadge})`, memberBadge >= 1);
  // pick an internal member (امیر) — full list is open, no need to type
  // type to narrow then click the امیر row
  await peopleInput.fill("امیر");
  await page.waitForTimeout(900);
  const amirRow = page.locator('[data-idx="0"]').first();
  await amirRow.waitFor({ state: "visible", timeout: 15000 });
  await amirRow.click();
  await page.waitForTimeout(600);
  const chip = await page.locator('span.chip, span.rounded-full:has-text("امیر حسینی")').count();
  check("internal member picked → chip", chip >= 1 || (await page.locator('text=امیر حسینی').count()) >= 1);

  // type a brand-new external name and quick-add with Enter (input inside the combobox)
  const comboInput = page.locator('div.min-h-11 input').first();
  await comboInput.click();
  await comboInput.fill("زائر مهمان تستی");
  await page.waitForTimeout(600);
  await comboInput.press("Enter");
  await page.waitForTimeout(500);
  const chip2 = await page.locator('div.min-h-11 span.rounded-full', { hasText: 'زائر مهمان تستی' }).count();
  check("manual typed external person added as chip", chip2 >= 1);
  await page.screenshot({ path: "D:/meetinghub/e2e-peoplepicker.png" });

  // ── 5. availability page PeoplePicker renders ──
  await page.goto("http://localhost:3100/availability", { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder*="جستجو و انتخاب"]').first().waitFor({ state: "visible", timeout: 30000 });
  const availPicker = await page.locator('input[placeholder*="جستجو و انتخاب"]').count();
  check("availability has PeoplePicker", availPicker === 1);

  // ── 6. meeting detail: jalali picker in reschedule ──
  await page.goto("http://localhost:3100/meetings/seed-meeting-1", { waitUntil: "domcontentloaded" });
  await page.locator('button:has-text("زمان‌بندی مجدد")').waitFor({ state: "visible", timeout: 30000 });
  await page.click('button:has-text("زمان‌بندی مجدد")');
  await page.waitForTimeout(1500);
  const rsPickers = await page.locator('button[aria-haspopup="dialog"]').count();
  check(`reschedule uses Jalali picker (${rsPickers})`, rsPickers >= 1);
  const nativeRS = await page.locator("select").count();
  check("reschedule has zero native selects", nativeRS === 0);

  let pass = 0;
  for (const [n, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} | ${n}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
