// E2E: fixed chat — direction, contrast, emoji size, REAL file upload
const { chromium } = require('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const login = async (em) => (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const ac = await login('admin@example.com');
  const users = await (await fetch(B + '/api/users?q=amir', { headers: { cookie: ac } })).json();
  const amirId = users.data.users.find(u => u.email === 'amir@example.com')?.id;
  const aliUsers = await (await fetch(B + '/api/users?q=ali', { headers: { cookie: ac } })).json();
  const aliId = aliUsers.data.users.find(u => u.email === 'ali@example.com')?.id;
  const d = new Date(Date.now() + 37 * 86400000); d.setUTCHours(6, 0, 0, 0);
  const cr = await fetch(B + '/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ organizerId: aliId, title: 'فیکس چت تست', branchId: 'branch-niavaran', roomId: 'room-a', startAt: d.toISOString(), endAt: new Date(d.getTime() + 3600000).toISOString(), meetingType: 'INTERNAL', participantIds: [amirId] }) });
  const mid = (await cr.json()).data.meeting.id;
  // a message from the OTHER side (amir)
  const amirC = await login('amir@example.com');
  await fetch(B + '/api/meetings/' + mid + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: amirC }, body: JSON.stringify({ body: 'پیام طرف مقابل' }) });
  const rl = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ali@example.com', password: 'Pass1234' }) });
  for (const c of rl.headers.getSetCookie()) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }
  await page.goto(B + '/discussion?m=' + mid, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const r = {};
  // 1) send own message → must sit on the RIGHT half of the chat column
  await page.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) ta.focus(); });
  await page.keyboard.type('پیام خودم جهت‌دار', { delay: 12 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  r.ownRight = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('پیام خودم جهت‌دار'));
    let el = cands[cands.length - 1];
    while (el && !String(el.className).includes('rounded')) el = el.parentElement;
    if (!el) return false;
    const list = el.closest('.overflow-y-auto');
    if (!list) return false;
    const lr = list.getBoundingClientRect();
    return el.getBoundingClientRect().right > lr.left + lr.width / 2;
  });
  // other's message on the LEFT half
  r.otherLeft = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('پیام طرف مقابل'));
    let el = cands[cands.length - 1];
    while (el && !String(el.className).includes('rounded')) el = el.parentElement;
    if (!el) return false;
    const list = el.closest('.overflow-y-auto');
    if (!list) return false;
    const lr = list.getBoundingClientRect();
    return el.getBoundingClientRect().left < lr.left + lr.width / 2;
  });
  // 2) own bubble = dark ink with WHITE text (contrast)
  r.ownContrast = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('div')].filter(x => x.textContent.includes('پیام خودم جهت‌دار'));
    let el = cands[cands.length - 1];
    while (el && !String(el.className).includes('rounded')) el = el.parentElement;
    if (!el) return false;
    const st = getComputedStyle(el);
    return st.backgroundColor === 'rgb(13, 13, 13)' && st.color === 'rgb(255, 255, 255)';
  });
  // 3) emoji: panel + big glyphs + does NOT close on pick
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="ایموجی"]'); if (b) b.click(); });
  await page.waitForTimeout(500);
  r.emojiBig = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '😍');
    return btn ? parseFloat(getComputedStyle(btn).fontSize) >= 20 : false;
  });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '🔥'); if (b) b.click(); });
  await page.waitForTimeout(300);
  r.emojiStaysOpen = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '😍'));
  // 4) REAL file upload via the attach input
  const tmp = process.env.TEMP + '/chat-upload-test.pdf';
  fs.writeFileSync(tmp, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));
  await page.setInputFiles('input[type="file"]', tmp);
  await page.waitForTimeout(3000);
  r.fileUploaded = await page.evaluate(() => document.body.innerText.includes('به پیوست‌های جلسه اضافه شد'));
  // verify attachment row exists via API
  const atts = await (await fetch(B + '/api/meetings/' + mid + '/attachments', { headers: { cookie: ac } })).json();
  r.attachmentRow = (atts?.data?.attachments ?? []).length > 0;

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'CHAT FIXED ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
  await fetch(B + '/api/meetings/' + mid + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ reason: 'OTHER' }) });
  await browser.close();
})().catch(e => console.log('ERR', String(e).slice(0, 250)));
