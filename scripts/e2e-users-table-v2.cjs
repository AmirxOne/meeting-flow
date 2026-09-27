// E2E: آیکون تنظیم فردی → مودال؛ انتخاب چند نفر → تنظیم گروهی؛ دوره‌ها داخل جدول
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));

  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('#login-identifier', 'admin@example.com');
  await page.fill('#login-password', 'Pass1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 90000 });
  await page.goto('http://localhost:3100/users', { waitUntil: 'networkidle', timeout: 90000 });
  const killTour = () => page.evaluate(() => {
    document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove());
    const skip = [...document.querySelectorAll('button')].find((b) => /رد کردن|متوجه شدم|بستن تور|بعدی|پیش/.test(b.textContent || ''));
    if (skip) skip.click();
  });
  await killTour();
  await page.waitForTimeout(6000);
  await killTour();

  // ScheduleBar قدیمی حذف شده؟
  console.log('no schedule bar card:', (await page.locator('text=زمان‌بندی اعلام زمان‌های آزاد').count()) === 0);
  console.log('org defaults line:', (await page.locator('text=پیش‌فرض سازمان:').count()) > 0);

  // آیکون تنظیم فردی در ردیف‌ها
  const gearIcons = await page.locator('button[aria-label^="تنظیم زمان‌بندی"]').count();
  console.log('per-row gear icons:', gearIcons);

  // کلیک روی اولین آیکون → مودال
  await page.evaluate(() => { const b = document.querySelector('button[aria-label^="تنظیم زمان‌بندی"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const modalVisible = (await page.locator('text=زمان‌بندی اعلام زمان —').count()) > 0 || (await page.locator('text=پیروی از تنظیم سازمان').count()) > 0;
  console.log('schedule modal opens:', modalVisible);
  // بستن
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // انتخاب دو نفر → تنظیم گروهی
  const boxes = page.locator('input[aria-label^="انتخاب"]');
  await killTour(); await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.waitForTimeout(400);
  console.log('group button:', (await page.locator('text=تنظیم گروهی زمان‌بندی').count()) > 0);
  await killTour(); await page.locator('text=تنظیم گروهی زمان‌بندی').first().click();
  await page.waitForTimeout(1000);
  console.log('group modal (نفر):', (await page.locator('text=/تنظیم گروهی زمان‌بندی \\(/').count()) > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ردیف بازشو دوره‌ها — chevron
  const chev = page.locator('button[aria-label="نمایش دوره‌ها"]');
  const chevCount = await chev.count();
  console.log('expand chevrons (users with requests):', chevCount);
  if (chevCount > 0) {
    await killTour(); await chev.first().click();
    await page.waitForTimeout(800);
    const chips = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /\d{2}:\d{2}-\d{2}:\d{2}/.test(l)).length);
    console.log('expanded row time chips:', chips);
    console.log('expanded shows مهلت:', (await page.locator('text=مهلت:').count()) > 0);
  }

  console.log('js errors:', errors.length, errors.slice(0, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
