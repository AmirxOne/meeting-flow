// E2E v2b — همه تعاملات با JS click (مقاوم به اوورلی تور و مودال)
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
  await page.waitForTimeout(6000);

  const kill = async () => page.evaluate(() => {
    document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove());
  });
  const clickByText = (txt) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes(t) || x.getAttribute('aria-label')?.includes(t));
    if (b) { b.click(); return true; }
    return false;
  }, txt);

  await kill();
  console.log('org defaults line:', (await page.locator('text=پیش‌فرض سازمان:').count()) > 0);
  console.log('gear icons:', await page.locator('button[aria-label^="تنظیم زمان‌بندی"]').count());

  // ۱) مودال فردی
  await page.evaluate(() => document.querySelector('button[aria-label^="تنظیم زمان‌بندی"]').click());
  await page.waitForTimeout(1200);
  console.log('single modal:', (await page.locator('text=پیروی از تنظیم سازمان').count()) > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  // اگر بسته نشد با دکمه انصراف
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'انصراف');
    if (b) b.click();
  });
  await page.waitForTimeout(600);

  // ۲) انتخاب دو نفر — رفرش تمیز، تور را با دکمه‌ی خودش می‌بندیم (بدون حذف DOM)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /رد کردن|متوجه شدم|بعدی|پیش|Skip/.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(800);
  const checked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('input[aria-label^="انتخاب"]')].slice(0, 2);
    rows.forEach((b) => b.click());
    return rows.length;
  });
  await page.waitForTimeout(700);
  console.log('checked rows:', checked);
  console.log('selection bar:', (await page.locator('text=نفر انتخاب‌شده').count()) > 0);
  console.log('group button appears:', await clickByText('تنظیم گروهی زمان‌بندی'));

  // ۳) ردیف بازشو
  await page.waitForTimeout(400);
  const chev = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="نمایش دوره‌ها"]');
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(900);
  const chips = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /\d{2}:\d{2}-\d{2}:\d{2}/.test(l)).length);
  console.log('chevron clicked:', chev, '| expanded time chips:', chips);

  console.log('js errors:', errors.length, errors.slice(0, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
