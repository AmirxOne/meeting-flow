// E2E: guests appear in the attendance card; organizer can mark them
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3100';
const MEETING = 'cmue2423301p5u9dsfgqb6662'; // تست checkin — operator + 3 guests

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@example.com', password: 'Pass1234' }),
  });
  console.log('operator login:', r.status);
  await ctx.addCookies(r.headers.getSetCookie().map(c => {
    const [kv] = c.split(';'); const [name, ...rest] = kv.split('=');
    return { name, value: rest.join('='), domain: '127.0.0.1', path: '/' };
  }));

  await page.goto(`${BASE}/meetings/${MEETING}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('nextstep-seen:cmta18b1q001ju9ocd9of30nz', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const out = {};
  out.card = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="meeting-attendance"]');
    if (!card) return null;
    return {
      title4of4: card.innerText.includes('۴/۴') || card.innerText.includes('۰/۴'),
      guestRows: card.querySelectorAll('[data-testid^="attendance-guest-"]:not([data-testid$="-PRESENT"]):not([data-testid$="-LATE"]):not([data-testid$="-ABSENT"]):not([data-testid$="-EXCUSED"])').length,
      guestNames: card.innerText.includes('مهمان checkin') && card.innerText.includes('مهمان دوم'),
      markBtns: card.querySelectorAll('[data-testid$="-PRESENT"]').length,
    };
  });

  // mark a guest PRESENT via the UI
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid^="attendance-guest-"][data-testid$="-PRESENT"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1200);
  out.persisted = await page.evaluate(async () => {
    const res = await fetch('/api/meetings/cmue2423301p5u9dsfgqb6662/attendance', { credentials: 'include' });
    const j = await res.json();
    return (j?.data?.guests ?? []).filter(g => g.attendanceStatus).length;
  });

  // clean the mark
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid^="attendance-guest-"][data-testid$="-PRESENT"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  out.jsErrors = errors.length;
  console.log(JSON.stringify(out, null, 1));
  const ok = out.card && (out.card.title4of4 || out.card.title4of4 === false ? out.card.title4of4 : true) && out.card.guestRows === 3 && out.card.guestNames && out.card.markBtns >= 4 && out.persisted >= 1 && out.jsErrors === 0;
  console.log(ok ? 'GUEST ATTENDANCE ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
