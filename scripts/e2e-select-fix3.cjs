// E2E final: the three dropdown fixes, trigger scrolled properly into view
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 700 } });
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

  await page.goto('http://127.0.0.1:3100/meetings/cmudwad6u000eu960ia57ayqo', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.setItem('nextstep-seen:cmta18b0u001hu9ocmsdlskyn', JSON.stringify(['dashboard','meeting-detail','calendar','meetings','people','rooms','availability','reports','notifications','branches','users','profile','admin','admin-policies','admin-settings']));
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'دسترسی‌ها'); if (b) b.click(); });
  await page.waitForTimeout(1000);

  // scroll so the LAST dropdown trigger sits near the viewport bottom (forces flip-above)
  await page.evaluate(() => {
    const trig = [...document.querySelectorAll('[aria-haspopup="listbox"]')].pop();
    const t = trig.getBoundingClientRect();
    window.scrollBy(0, t.bottom - (window.innerHeight - 80));
  });
  await page.waitForTimeout(300);

  // FIX 1: opening must not move the page
  const y1 = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => { [...document.querySelectorAll('[aria-haspopup="listbox"]')].pop().click(); });
  await page.waitForTimeout(500);
  const y2 = await page.evaluate(() => window.scrollY);

  // FIX 2: flush gap + panel inside the viewport
  const geo = await page.evaluate(() => {
    const trig = [...document.querySelectorAll('[aria-haspopup="listbox"]')].pop();
    const panel = [...document.querySelectorAll('ul[role="listbox"]')].pop();
    const t = trig.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return {
      trigIn: { top: Math.round(t.top), bottom: Math.round(t.bottom) },
      panel: { top: Math.round(p.top), bottom: Math.round(p.bottom), h: Math.round(p.height) },
      gap: Math.round(p.top >= t.bottom - 1 ? p.top - t.bottom : t.top - p.bottom),
      inView: p.top >= 0 && p.bottom <= window.innerHeight,
      vh: window.innerHeight,
    };
  });

  // FIX 3: instant label update
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('li[role="option"]')];
    const t = items.find(li => li.textContent.includes('فقط برگزارکننده'));
    if (t) t.click();
  });
  await page.waitForTimeout(600);
  const labelVal = await page.evaluate(() => [...document.querySelectorAll('[aria-haspopup="listbox"]')].pop()?.textContent.trim().slice(0, 25));

  const out = { noJump: y1 === y2, y1, y2, geo, labelVal, updated: labelVal === 'فقط برگزارکننده', jsErrors: errors.length };
  console.log(JSON.stringify(out, null, 1));
  const ok = out.noJump && geo.gap <= 10 && geo.inView && out.updated && out.jsErrors === 0;
  console.log(ok ? 'ALL THREE FIXES ✅' : 'CHECK ❌');
  await browser.close();
})().catch(e => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
