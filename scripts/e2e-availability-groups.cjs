// E2E: نمای گروهی دوره‌ای — افراد + اسلات‌های روز/ساعت زیر هر فرد
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
  await page.waitForTimeout(5000);

  // هدر گروه دوره
  const groupHeader = await page.locator('text=مهلت:').count();
  console.log('period group headers (مهلت:):', groupHeader);

  // چیپ‌های روز+ساعت — مثلا «۰۹:۰۰-۱۲:۰۰»
  const timeChips = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /\d{2}:\d{2}-\d{2}:\d{2}/.test(l)).length);
  console.log('day+time slot chips:', timeChips);

  // نام روز فارسی در چیپ
  const dayName = await page.locator('text=/شنبه|یکشنبه|دوشنبه/').count();
  console.log('farsi day labels visible:', dayName);

  // بج وضعیت
  console.log('submitted badges:', await page.locator('text=ثبت شده').count());
  console.log('pending badges:', await page.locator('text=در انتظار ثبت').count());

  // دراپ‌داون قفل حذف شده؟
  const disabledSelects = await page.locator('button[aria-haspopup="listbox"][disabled]').count();
  console.log('locked selects (must be 0):', disabledSelects);

  // دراپ‌داون باز/بسته/باز
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('تنظیمات زمان‌بندی'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
  const trig = page.locator('[aria-haspopup="listbox"]:not([disabled])').first();
  await trig.click(); await page.waitForTimeout(400);
  const o1 = await page.locator('[role="option"]').count();
  await page.mouse.click(10, 300); await page.waitForTimeout(500);
  await trig.click(); await page.waitForTimeout(600);
  const o2 = await page.locator('[role="option"]').count();
  console.log('dropdown reopen: open1 =', o1, ', reopen =', o2);

  console.log('js errors:', errors.length, errors.slice(0, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
