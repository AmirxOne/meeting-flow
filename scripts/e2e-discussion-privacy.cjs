// E2E: discussion privacy — only the meeting's own people can open/discuss it
// run from project root (needs playwright from node_modules)
const { chromium } = require('playwright');

const B = 'http://127.0.0.1:3100';
const login = async (em) => (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie().map(c => c.split(';')[0]).join('; ');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const setLogin = async (em) => {
    await ctx.clearCookies();
    for (const c of (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: 'Pass1234' }) })).headers.getSetCookie()) {
      const p = c.split(';')[0]; const i = p.indexOf('=');
      await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]);
    }
  };

  const ac = await login('admin@example.com');
  const users = await (await fetch(B + '/api/users?q=amir', { headers: { cookie: ac } })).json();
  const amirId = users.data.users.find(u => u.email === 'amir@example.com')?.id;
  const aliUsers = await (await fetch(B + '/api/users?q=ali', { headers: { cookie: ac } })).json();
  const aliId = aliUsers.data.users.find(u => u.email === 'ali@example.com')?.id;
  const d = new Date(Date.now() + 50 * 86400000); d.setUTCHours(6, 0, 0, 0);
  const TITLE = 'حریم گفتگو e2e';
  const cr = await fetch(B + '/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ organizerId: aliId, title: TITLE, branchId: 'branch-niavaran', roomId: 'room-a', startAt: d.toISOString(), endAt: new Date(d.getTime() + 3600000).toISOString(), meetingType: 'INTERNAL', participantIds: [amirId] }) });
  const mid = (await cr.json()).data.meeting.id;

  const r = {};
  // API: outsiders (even admin) get 403
  r.apiOutsiderAdmin = (await fetch(B + '/api/meetings/' + mid + '/messages', { headers: { cookie: ac } })).status === 403;
  const sc = await login('sara@example.com');
  r.apiOutsiderSara = (await fetch(B + '/api/meetings/' + mid + '/messages', { headers: { cookie: sc } })).status === 403;
  // organizer + participant can read
  r.apiOrganizer = (await fetch(B + '/api/meetings/' + mid + '/messages', { headers: { cookie: await login('ali@example.com') } })).status === 200;
  r.apiParticipant = (await fetch(B + '/api/meetings/' + mid + '/messages', { headers: { cookie: await login('amir@example.com') } })).status === 200;

  // PAGE: sara gets the 404 screen (content-based; streaming Next may return 200 status)
  await setLogin('sara@example.com');
  await page.goto(B + '/discussion/' + mid, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(1500);
  const saraBody = await page.evaluate(() => document.body.innerText);
  // blocked = meeting data does NOT leak AND the 404 screen is shown
  r.pageSaraBlocked = !saraBody.includes(TITLE) && !saraBody.includes('۰/۲۰۰۰') && /۴۰۴|404|یافت نشد/.test(saraBody);

  // sara's hub never lists it
  await page.goto(B + '/discussion', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  r.saraHubClean = await page.evaluate((t) => !document.body.innerText.includes(t), TITLE);

  // ali (organizer) opens the room fine
  await setLogin('ali@example.com');
  await page.goto(B + '/discussion?m=' + mid, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  r.aliRoomOpens = await page.evaluate((t) => document.body.innerText.includes(t), TITLE);

  // meeting page entry card: hidden for non-involved admin, visible for participant amir
  await setLogin('admin@example.com');
  await page.goto(B + '/meetings/' + mid, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  r.adminNoEntryCard = await page.evaluate(() => !document.body.innerText.includes('ورود به گفتگو'));
  await setLogin('amir@example.com');
  await page.goto(B + '/meetings/' + mid, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  r.amirSeesEntryCard = await page.evaluate(() => document.body.innerText.includes('ورود به گفتگو'));

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'DISCUSSION PRIVACY ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));

  await fetch(B + '/api/meetings/' + mid + '/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ac }, body: JSON.stringify({ reason: 'OTHER' }) });
  await browser.close();
})().catch(e => console.log('ERR', String(e).slice(0, 200)));
