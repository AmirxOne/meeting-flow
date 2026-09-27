// E2E: نوار اکشن — ۱ نفر → هیچ نوار؛ ۲ نفر → نوار sticky بالای جدول
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
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /رد کردن|متوجه شدم|بعدی|پیش/.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(800);

  // صبر برای رندر جدول
  await page.waitForSelector('input[aria-label^="انتخاب"]', { timeout: 30000 });
  // ۱ نفر → بدون نوار
  await page.evaluate(() => document.querySelectorAll('input[aria-label^="انتخاب"]')[0].click());
  await page.waitForTimeout(800);
  console.log('1 selected → bar hidden:', (await page.locator('text=نفر انتخاب‌شده').count()) === 0);

  // ۲ نفر → نوار ظاهر
  await page.evaluate(() => document.querySelectorAll('input[aria-label^="انتخاب"]')[1].click());
  await page.waitForTimeout(600);
  const bar = page.locator('text=نفر انتخاب‌شده').first();
  console.log('2 selected → bar visible:', (await bar.count()) > 0);

  // نوار بالای جدول است (sticky، قبل از ردیف‌ها) — چک ترتیب DOM با هدر جدول
  const order = await page.evaluate(() => {
    const barEl = [...document.querySelectorAll('span')].find((s) => s.textContent?.includes('نفر انتخاب‌شده'));
    const header = [...document.querySelectorAll('p')].find((p) => p.textContent === 'افراد');
    if (!barEl || !header) return 'missing';
    return barEl.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING ? 'bar-before-header ✅' : 'bar-after-header ❌';
  });
  console.log('position:', order);

  // sticky class
  const sticky = await page.evaluate(() => {
    const barEl = [...document.querySelectorAll('span')].find((s) => s.textContent?.includes('نفر انتخاب‌شده'))?.parentElement;
    return barEl?.className.includes('sticky') ?? false;
  });
  console.log('bar is sticky:', sticky);

  // اسکرول پایین — نوار می‌ماند (sticky top)؛ صبر برای smooth
  await page.evaluate(() => new Promise((res) => { window.scrollTo({ top: 800, behavior: 'instant' }); setTimeout(res, 300); }));
  const stillVisible = await page.evaluate(() => {
    const barEl = [...document.querySelectorAll('span')].find((s) => s.textContent?.includes('نفر انتخاب‌شده'));
    if (!barEl) return false;
    const r = barEl.getBoundingClientRect();
    return r.top >= 0 && r.top < 200; // نزدیک بالای viewport (زیر هدر)
  });
  console.log('stays visible after scroll:', stillVisible);

  console.log('js errors:', errors.length);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
