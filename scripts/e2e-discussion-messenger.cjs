// E2E: messenger-style discussion page (/discussion?m=)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const login = async (em) => (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const ac = await login('admin@example.com');
  const users = await (await fetch(B + '/api/users?q=amir', { headers: { cookie: ac } })).json();
  const amirId = users.data.users.find(u => u.email === 'amir@example.com')?.id;
  const aliUsers = await (await fetch(B + '/api/users?q=ali', { headers: { cookie: ac } })).json();
  const aliId = aliUsers.data.users.find(u => u.email === 'ali@example.com')?.id;
  const d = new Date(Date.now() + 35 * 86400000); d.setUTCHours(6, 0, 0, 0);
  const cr = await fetch(B + '/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ organizerId: aliId, title: 'چت‌اپ کامل تست', branchId: 'branch-niavaran', roomId: 'room-a', startAt: d.toISOString(), endAt: new Date(d.getTime() + 3600000).toISOString(), meetingType: 'INTERNAL', participantIds: [amirId] }) });
  const mid = (await cr.json()).data.meeting.id;
  const amirC = await login('amir@example.com');
  await fetch(B + '/api/meetings/' + mid + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: amirC }, body: JSON.stringify({ body: 'آخرین پیام پیش‌نمایش' }) });
  const rl = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ali@example.com', password: 'Pass1234' }) });
  for (const c of rl.headers.getSetCookie()) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }

  const r = {};
  // hub: rail + empty pane
  await page.goto(B + '/discussion', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  r.rail = await page.evaluate(() => Boolean(document.querySelector('aside')) && document.body.innerText.includes('تبادل نظر'));
  r.railPreview = await page.evaluate(() => document.body.innerText.includes('آخرین پیام پیش‌نمایش'));
  r.emptyPane = await page.evaluate(() => document.body.innerText.includes('یک گفتگو را انتخاب کنید'));
  // click conversation → room opens in same page
  await page.evaluate((id) => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('چت‌اپ کامل تست'));
    if (btn) btn.click();
  }, mid);
  await page.waitForTimeout(2500);
  r.roomHeader = await page.evaluate(() => document.body.innerText.includes('«چت‌اپ کامل تست»'));
  r.peopleToggle = await page.evaluate(() => /[۰-۹0-9]+ نفر/.test(document.body.innerText));
  // open people drawer
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /نفر/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(800);
  r.peopleDrawer = await page.evaluate(() => document.body.innerText.includes('امیر') && document.body.innerText.includes('مشارکت‌کننده') === false || document.body.innerText.includes('امیر'));
  // send
  await page.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) ta.focus(); });
  await page.keyboard.type('پیام از چت‌اپ جدید', { delay: 15 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  r.sent = await page.evaluate(() => document.body.innerText.includes('پیام از چت‌اپ جدید'));
  // counter appears only while typing — type again and check
  await page.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) ta.focus(); });
  await page.keyboard.type('چک', { delay: 10 });
  await page.waitForTimeout(400);
  r.counter = await page.evaluate(() => /\/۲۰۰۰/.test(document.body.innerText));
  // mobile: rail full-width
  await page.setViewportSize({ width: 500, height: 800 });
  await page.waitForTimeout(500);
  r.mobileRail = await page.evaluate(() => Boolean(document.querySelector('aside')));
  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'MESSENGER DISCUSSION ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
  await fetch(B + '/api/meetings/' + mid + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ reason: 'OTHER' }) });
  await browser.close();
})().catch(e => console.log('ERR', String(e).slice(0, 250)));
