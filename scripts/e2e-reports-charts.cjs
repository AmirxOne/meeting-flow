// E2E: org reports page — charts (trend/donut/bars/hourly)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const rl = (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }) })).headers.getSetCookie();
  for (const c of rl) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }
  await page.goto('http://127.0.0.1:3100/reports', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  const r = {};
  r.trendTitle = await page.evaluate(() => document.body.innerText.includes('روند روزانه جلسات'));
  r.trendLine = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    return svgs.some((s) => s.querySelectorAll('circle').length > 3 && s.querySelector('path'));
  });
  r.donutTitle = await page.evaluate(() => document.body.innerText.includes('سهم شعبه‌ها'));
  r.donutArcs = await page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find((x) => x.childElementCount === 0 && x.textContent === 'سهم شعبه‌ها');
    let c = h;
    while (c && !c.querySelector('svg')) c = c.parentElement.parentElement;
    return c ? c.querySelectorAll('svg circle').length : 0;
  });
  r.roomsTitle = await page.evaluate(() => document.body.innerText.includes('اشغال اتاق‌های جلسات'));
  r.roomBars = await page.evaluate(() => /ساعت · ٪[۰-۹]/.test(document.body.innerText));
  r.hourly = await page.evaluate(() => document.body.innerText.includes('ساعت‌های پرتقاضا'));
  r.hasFaNums = await page.evaluate(() => /[۰-۹]/.test(document.body.innerText));
  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'REPORTS CHARTS ✅' : 'CHECK ❌');
  await browser.close();
})().catch((e) => console.log('ERR', String(e).slice(0, 200)));
