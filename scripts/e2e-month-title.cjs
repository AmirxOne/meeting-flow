// E2E: calendar month title must change when paging months
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const rl = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }) });
  for (const c of rl.headers.getSetCookie()) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }
  await page.goto(B + '/calendar', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  const title = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(x => x.childElementCount === 0 && /[۰-۹]{4}/.test(x.textContent) && x.textContent.trim().length < 30);
    return el ? el.textContent.trim() : null;
  });

  const t0 = await title();
  // click via JS (animation makes actionability waits flaky) — arrows carry chevron-only SVGs
  const clickedNext = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.getAttribute('title')?.includes('بعد') || x.getAttribute('aria-label') === 'بعدی');
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1400);
  const t1 = await title();
  const clickedPrev = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => x.getAttribute('title')?.includes('قبلی') || x.getAttribute('aria-label') === 'قبلی');
    if (b) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1400);
  const t2 = await title();

  console.log(JSON.stringify({ initial: t0, afterNext: t1, afterPrev: t2, nextBtn: clickedNext, prevBtn: clickedPrev }));
  console.log(t0 && t1 && t1 !== t0 ? 'MONTH TITLE PAGES ✅' : 'MONTH TITLE STUCK ❌');
  await browser.close();
})().catch(e => console.log('ERR', String(e).slice(0, 200)));
