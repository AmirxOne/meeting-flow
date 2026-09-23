// E2E: minutes card shows a clear no-access state for cross-org meetings
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

  await page.goto('http://127.0.0.1:3100/meetings/cmudx5ebg0050u9lwh22f5xiu', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(() => {
    const txt = document.body.innerText;
    const card = document.querySelector('[data-testid="meeting-minutes"]');
    return {
      noAccessMsg: txt.includes('دسترسی به صورت‌جلسه ندارید'),
      noGuttedTabs: !(txt.split('\n').filter(l => ['موضوعات مطرح‌شده', 'دسترسی‌ها'].includes(l.trim())).length === 2 && !txt.includes('خلاصه جلسه')),
      cardPresent: Boolean(card),
    };
  });
  out.jsErrors = errors.length;
  console.log(JSON.stringify(out, null, 1));

  // also verify the OWN meeting still shows all 4 tabs
  await page.goto('http://127.0.0.1:3100/meetings/cmudwad6u000eu960ia57ayqo', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const own = await page.evaluate(() => {
    const txt = document.body.innerText;
    return { summary: txt.includes('خلاصه جلسه'), body: txt.includes('متن کامل'), topics: txt.includes('موضوعات مطرح‌شده'), access: txt.includes('دسترسی‌ها') };
  });
  console.log('own meeting tabs:', JSON.stringify(own));
  const ok = out.noAccessMsg && out.noGuttedTabs && out.jsErrors === 0 && own.summary && own.body && own.topics && own.access;
  console.log(ok ? 'NO-ACCESS STATE ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
