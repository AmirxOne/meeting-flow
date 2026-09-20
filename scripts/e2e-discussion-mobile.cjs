// E2E: mobile responsive discussion — rail full-width, tap → chat PAGE fills viewport
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const login = async (em) => (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const ac = await login('admin@example.com');
  const users = await (await fetch(B + '/api/users?q=amir', { headers: { cookie: ac } })).json();
  const amirId = users.data.users.find(u => u.email === 'amir@example.com')?.id;
  const aliUsers = await (await fetch(B + '/api/users?q=ali', { headers: { cookie: ac } })).json();
  const aliId = aliUsers.data.users.find(u => u.email === 'ali@example.com')?.id;
  const d = new Date(Date.now() + 45 * 86400000); d.setUTCHours(6, 0, 0, 0);
  const cr = await fetch(B + '/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ organizerId: aliId, title: 'موبایل ریسپانسیو تست', branchId: 'branch-niavaran', roomId: 'room-a', startAt: d.toISOString(), endAt: new Date(d.getTime() + 3600000).toISOString(), meetingType: 'INTERNAL', participantIds: [amirId] }) });
  const mid = (await cr.json()).data.meeting.id;
  const amirC = await login('amir@example.com');
  await fetch(B + '/api/meetings/' + mid + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: amirC }, body: JSON.stringify({ body: 'پیام در موبایل' }) });
  const rl = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ali@example.com', password: 'Pass1234' }) });
  for (const c of rl.headers.getSetCookie()) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }

  await page.goto(B + '/discussion', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const r = {};
  r.railVisible = await page.evaluate(() => {
    const railSearch = document.querySelector('input[placeholder="جستجوی جلسه…"]');
    if (!railSearch) return false;
    const rail = railSearch.closest('aside');
    return rail && rail.getBoundingClientRect().width > 300; // full-width on phone
  });
  // tap conversation → navigates to the dedicated chat PAGE
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('موبایل ریسپانسیو تست')); if (b) b.click(); });
  await page.waitForTimeout(2500);
  r.navigatedToPage = page.url().includes('/discussion/' + mid);
  r.headerShown = await page.evaluate(() => document.body.innerText.includes('موبایل ریسپانسیو تست'));
  r.seedMsg = await page.evaluate(() => document.body.innerText.includes('پیام در موبایل'));
  r.chatFills = await page.evaluate(() => {
    const el = document.querySelector('section .overflow-y-auto');
    return el ? el.getBoundingClientRect().height > 400 : false;
  });
  r.backBtn = await page.evaluate(() => Boolean(document.querySelector('a[href="/discussion"]')));
  // send from mobile
  await page.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) ta.focus(); });
  await page.keyboard.type('از موبایل فرستادم', { delay: 15 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  r.sent = await page.evaluate(() => document.body.innerText.includes('از موبایل فرستادم'));

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'MOBILE CHAT ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
  await fetch(B + '/api/meetings/' + mid + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ reason: 'OTHER' }) });
  await browser.close();
})().catch(e => console.log('ERR', String(e).slice(0, 200)));
