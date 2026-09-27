// E2E: صفحه‌ی کاربران جدید — جدول ادمین + تنظیمات + دوره‌ها
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
  await page.evaluate(() => document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove()));
  await page.waitForTimeout(6000);

  // جدول حرفه‌ای
  console.log('schedule bar:', (await page.locator('text=زمان‌بندی اعلام زمان‌های آزاد').count()) > 0);
  console.log('table header افراد:', (await page.locator('text=اعلام زمان آزاد').count()) > 0);
  const rows = await page.locator('input[type="checkbox"][aria-label*="انتخاب"]').count();
  console.log('selectable rows:', rows);

  // انتخاب همه از هدر جدول
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('انتخاب همه'));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  console.log('selection bar:', (await page.locator('text=نفر انتخاب‌شده').count()) > 0);
  console.log('apply btn:', (await page.locator('text=مشمول اعلام زمان کن').count()) > 0);

  // دوره‌های ثبت‌شده پایین
  console.log('periods card:', (await page.locator('text=دوره‌های اعلام‌شده').count()) > 0);
  const chips = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /\d{2}:\d{2}-\d{2}:\d{2}/.test(l)).length);
  console.log('time chips:', chips);

  // دراپ‌داون‌های کاستوم، بدون native و بدون قفل
  console.log('native selects:', await page.locator('select:visible').count());
  console.log('locked selects:', await page.locator('button[aria-haspopup="listbox"][disabled]').count());

  // نقش غیرادمین: کارت‌ها
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 90000 });
  await p2.fill('#login-identifier', 'ali@example.com');
  await p2.fill('#login-password', 'Pass1234');
  await p2.click('button[type="submit"]');
  await p2.waitForTimeout(5000);
  await p2.goto('http://localhost:3100/users', { waitUntil: 'networkidle', timeout: 90000 });
  await p2.evaluate(() => document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove()));
  await p2.waitForTimeout(4000);
  console.log('non-admin: cards view:', (await p2.locator('text=اعلام زمان آزاد').count()) === 0, '| no schedule bar:', (await p2.locator('text=زمان‌بندی اعلام').count()) === 0);

  console.log('js errors:', errors.length, errors.slice(0, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
