// E2E: پنل ادمین availability — Select کاستوم، بازه‌ی ماه، جستجوی افراد
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  // تور راهنما را قبلاً دیده باش
  await page.addInitScript(() => {
    // هر userId — کل تورها seen
    localStorage.setItem('nextstep-seen:anon', JSON.stringify(['dashboard','users','calendar','meetings','reports']));
    try {
      const raw = localStorage.getItem('mh-me');
      if (raw) {
        const id = JSON.parse(raw)?.state?.me?.id;
        if (id) localStorage.setItem(`nextstep-seen:${id}`, JSON.stringify(['dashboard','users','calendar','meetings','reports']));
      }
    } catch {}
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('nextstep-seen')) localStorage.setItem(k, JSON.stringify(['dashboard','users','calendar','meetings','reports'])); });
  });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message.slice(0, 120)));

  // login
  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('#login-identifier', 'admin@example.com');
  await page.fill('#login-password', 'Pass1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 90000 });

  // users page
  await page.goto('http://localhost:3100/users', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000);

  const panel = page.locator('text=اعلام زمان‌های آزاد').first();
  const hasPanel = await panel.count();
  console.log('panel visible:', hasPanel > 0);

  // close guided tour if open, then open settings via JS click (overlay-proof)
  await page.evaluate(() => {
    document.querySelectorAll('[data-name="nextstep-overlay"]').forEach((el) => el.remove());
    const skip = [...document.querySelectorAll('button')].find((b) => /رد کردن|بستن|بله|^باشه|متوجه شدم|پیش/.test(b.textContent || ''));
    if (skip) skip.click();
  });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('تنظیمات زمان‌بندی'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(1500);

  // باز کردن Select بازه — دکمه‌های listbox
  const periodSel = page.locator('button[aria-haspopup="listbox"]').filter({ hasText: /بازه|هفته|ماه|انتخاب/ }).first();
  const periodSelCount = await periodSel.count();
  console.log('period select found:', periodSelCount > 0);

  // همه‌ی دراپ‌داون‌های تنظیمات باید کاستوم (listbox) باشند نه native
  const nativeSelects = await page.locator('select:visible').count();
  console.log('native <select> visible:', nativeSelects, '(must be 0)');

  // باز کردن دراپ‌داون بازه و انتخاب «ماه آینده»
  await periodSel.click();
  await page.waitForTimeout(600);
  const option = page.locator('[role="option"], [role="listbox"] >> text=ماه آینده').first();
  const optCount = await option.count();
  console.log('«ماه آینده» option visible:', optCount > 0);
  if (optCount > 0) await option.click();
  await page.waitForTimeout(400);

  // جستجوی فرد
  const search = page.locator('input[placeholder*="جستجوی فرد"]');
  console.log('people search box:', (await search.count()) > 0);

  // انتخاب همه
  const selectAll = page.locator('text=انتخاب همه');
  console.log('select-all button:', (await selectAll.count()) > 0);

  // چیپ انتخاب‌شده‌ها
  if (await selectAll.count()) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').includes('انتخاب همه')); if (b) b.click(); });
    await page.waitForTimeout(500);
    const chips = await page.locator('text=انتخاب‌شده (').count();
    console.log('selection chip bar:', chips > 0);
    const applyBtn = page.locator('text=مشمول فرآیند کن');
    console.log('apply button:', (await applyBtn.count()) > 0);
  }

  console.log('js errors:', jsErrors.length, jsErrors.slice(0, 3));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
