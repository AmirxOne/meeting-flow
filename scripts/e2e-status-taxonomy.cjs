// E2E: meeting status labels follow the employer's 5-category taxonomy
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

  // meetings list page — collect every status badge rendered
  await page.goto('http://127.0.0.1:3100/meetings', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const labels = await page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('.badge').forEach(b => set.add(b.textContent.trim()));
    return [...set];
  });

  const ALLOWED = ['لغو شده', 'تأیید شده', 'در حال برگزاری', 'در انتظار تأیید', 'برگزار شده'];
  const BAD = ['پایان یافته', 'قطعی شده', 'زمان‌بندی مجدد', 'رد شده', 'غیبت', 'پیش‌نویس'];
  const badFound = labels.filter(l => BAD.some(b => l.includes(b)));

  // also check the completed demo meeting detail badge
  await page.goto('http://127.0.0.1:3100/meetings/cmudwad6u000eu960ia57ayqo', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  const detailBadge = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.badge')].find(b => b.textContent.trim() === 'برگزار شده' || b.textContent.includes('پایان'));
    return el?.textContent.trim() ?? null;
  });

  const out = { labels, badFound, detailBadge, jsErrors: errors.length };
  console.log(JSON.stringify(out, null, 1));
  const ok = badFound.length === 0 && detailBadge === 'برگزار شده' && errors.length === 0;
  console.log(ok ? 'STATUS TAXONOMY ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
