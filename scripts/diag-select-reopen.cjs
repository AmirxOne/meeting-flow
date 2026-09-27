// diag: select re-open bug in availability panel
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 150)));

  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('#login-identifier', 'admin@example.com');
  await page.fill('#login-password', 'Pass1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 90000 });
  await page.goto('http://localhost:3100/users', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);

  // remove tour overlay
  await page.evaluate(() => document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove()));
  // open settings
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('تنظیمات زمان‌بندی'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  const trigger = page.locator('[aria-haspopup="listbox"]:not([disabled])').first();
  const info = (tag) => trigger.evaluate((el, t) => ({ t, expanded: el.getAttribute('aria-expanded') }, t));

  // open #1
  await trigger.click();
  await page.waitForTimeout(500);
  console.log(JSON.stringify(await info('open1')));
  const opts1 = await page.locator('[role="option"]').count();
  console.log('options visible (open1):', opts1);

  // close via outside click
  await page.mouse.click(10, 300);
  await page.waitForTimeout(600);
  console.log(JSON.stringify(await info('afterOutside')));
  const opts2 = await page.locator('[role="option"]').count();
  console.log('options visible (after close):', opts2);

  // open #2 — the reported bug
  await trigger.click();
  await page.waitForTimeout(700);
  console.log(JSON.stringify(await info('open2')));
  const opts3 = await page.locator('[role="option"]').count();
  console.log('options visible (open2):', opts3);

  // try clicking the trigger label directly + keyboard
  if (opts3 === 0) {
    await trigger.click({ force: true });
    await page.waitForTimeout(600);
    console.log('after force click options:', await page.locator('[role="option"]').count());
  }
  console.log('js errors:', errors);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
