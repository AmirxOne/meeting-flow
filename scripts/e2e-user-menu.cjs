// E2E: user menu closes on navigation, Esc, and tab blur
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));

  const r = await fetch('http://127.0.0.1:3100/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  });
  await ctx.addCookies(r.headers.getSetCookie().map(c => {
    const [kv] = c.split(';'); const [name, ...rest] = kv.split('=');
    return { name, value: rest.join('='), domain: '127.0.0.1', path: '/' };
  }));

  const isOpen = () => page.evaluate(() => Boolean([...document.querySelectorAll('div')].find(d => (d.className + '').includes('w-52') && d.textContent.includes('خروج از حساب'))));

  await page.goto('http://127.0.0.1:3100/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // open the menu
  await page.evaluate(() => { [...document.querySelectorAll('header button')].find(b => b.querySelector('img, span') && b.textContent.includes('علیرضا'))?.click(); });
  await page.waitForTimeout(400);
  const open1 = await isOpen();

  // 1) navigate via a sidebar link → menu must close
  await page.evaluate(() => { [...document.querySelectorAll('a[href="/calendar"], a[href="/meetings"]')][0]?.click(); });
  await page.waitForTimeout(1500);
  const openAfterNav = await isOpen();

  // reopen, then test Esc
  await page.evaluate(() => { [...document.querySelectorAll('header button')].find(b => b.textContent.includes('علیرضا'))?.click(); });
  await page.waitForTimeout(400);
  const open2 = await isOpen();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const openAfterEsc = await isOpen();

  // reopen, then blur the window (simulate switching browser tabs)
  await page.evaluate(() => { [...document.querySelectorAll('header button')].find(b => b.textContent.includes('علیرضا'))?.click(); });
  await page.waitForTimeout(400);
  const open3 = await isOpen();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(300);
  const openAfterBlur = await isOpen();

  const out = { opens: open1, closedOnNav: !openAfterNav, reopened: open2, closedOnEsc: !openAfterEsc, reopened2: open3, closedOnBlur: !openAfterBlur, jsErrors: errors.length };
  console.log(JSON.stringify(out, null, 1));
  const ok = open1 && !openAfterNav && open2 && !openAfterEsc && open3 && !openAfterBlur && errors.length === 0;
  console.log(ok ? 'USER MENU ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
