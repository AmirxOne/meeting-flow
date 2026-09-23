// E2E: organizer takes attendance on the real demo meeting
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3100';
const MEETING = 'cmudwad6u000eu960ia57ayqo'; // جلسه بازبینی محصول — admin organizer, COMPLETED

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));

  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  });
  await ctx.addCookies(r.headers.getSetCookie().map(c => {
    const [kv] = c.split(';'); const [name, ...rest] = kv.split('=');
    return { name, value: rest.join('='), domain: '127.0.0.1', path: '/' };
  }));

  await page.goto(`${BASE}/meetings/${MEETING}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try { localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings'])); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const out = {};
  out.card = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="meeting-attendance"]');
    if (!card) return null;
    const txt = card.innerText;
    return {
      title: txt.includes('حضورغیاب'),
      summary: txt.includes('حاضر') && txt.includes('غایب') && txt.includes('تأخیر') && txt.includes('معذرت'),
      rows: card.querySelectorAll('[data-testid^="attendance-row-"]').length,
      hasMarkButtons: Boolean(card.querySelector('[data-testid$="-PRESENT"]')),
    };
  });

  // mark the organizer PRESENT via the UI button (organizer row = first row)
  const clicked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid^="attendance-row-"]')];
    const first = rows[0];
    const btn = first?.querySelector('[data-testid$="-PRESENT"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1200);
  out.clickedBtn = clicked;
  out.afterMark = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="meeting-attendance"]');
    return { count: card?.innerText.includes('۱/۳') || card?.innerText.includes('۱/۲'), activeBtn: Boolean(card?.querySelector('[data-testid$="-PRESENT"].bg-emerald-600')) };
  });

  // verify persisted via API
  const apiCheck = await page.evaluate(async () => {
    const res = await fetch(`/api/meetings/cmudwad6u000eu960ia57ayqo/attendance`, { credentials: 'include' });
    const j = await res.json();
    return (j?.data?.attendance ?? []).filter(a => a.attendanceStatus).length;
  });
  out.persistedMarks = apiCheck;

  // toggle off (click the same button again)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid^="attendance-row-"]')];
    rows[0]?.querySelector('[data-testid$="-PRESENT"]')?.click();
  });
  await page.waitForTimeout(900);
  out.cleared = await page.evaluate(async () => {
    const res = await fetch(`/api/meetings/cmudwad6u000eu960ia57ayqo/attendance`, { credentials: 'include' });
    const j = await res.json();
    return (j?.data?.attendance ?? []).filter(a => a.attendanceStatus).length === 0;
  });

  out.jsErrors = errors.length;
  console.log(JSON.stringify(out, null, 1));
  const ok = out.card?.title && out.card?.summary && out.card?.rows >= 2 && out.card?.hasMarkButtons
    && out.persistedMarks >= 1 && out.cleared && out.jsErrors === 0;
  console.log(ok ? 'ATTENDANCE ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
