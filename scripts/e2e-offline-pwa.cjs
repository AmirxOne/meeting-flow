// E2E: full offline mode — SW serves offline.html with the intended destination,
// auto-retry returns the user to exactly where they were heading.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const B = 'http://127.0.0.1:3100';
  const r = {};
  // log in first so /meetings is reachable (middleware would redirect to /login otherwise)
  const rl = (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }) })).headers.getSetCookie();
  for (const c of rl) { const p = c.split(';')[0]; const i = p.indexOf('='); await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]); }

  // 1) load the app so the SW registers and precaches the shell
  await page.goto(B + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  r.swRegistered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg && (reg.active || reg.installing || reg.waiting));
  });
  // wait until the SW controls this page and shell is cached
  await page.waitForTimeout(1500);
  r.shellCached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shellKey = keys.find((k) => k.startsWith('mehrsa-shell'));
    if (!shellKey) return false;
    const c = await caches.open(shellKey);
    return Boolean(await c.match('/offline.html'));
  });

  // 2) go offline and navigate to a deep route — SW must serve offline.html
  await ctx.setOffline(true);
  await page.goto(B + '/meetings', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  r.offlineShown = await page.evaluate(() =>
    document.body && document.body.innerText.includes('اتصال برقرار نیست')
  );
  r.destShown = await page.evaluate(() =>
    document.body.innerText.includes('/meetings')
  );

  // 3) come back online — auto-retry should land on /meetings (the original target)
  await ctx.setOffline(false);
  await page.waitForTimeout(9000); // auto-ping every 3s
  r.backUrl = page.url();
  r.recovered = r.backUrl.includes('/meetings');

  console.log(JSON.stringify(r, null, 1));
  console.log(Object.values(r).every(Boolean) ? 'OFFLINE PWA ✅' : 'CHECK ❌ ' + Object.entries(r).filter(([, v]) => !v).map(([k]) => k).join(','));
  await browser.close();
})().catch((e) => console.log('ERR', String(e).slice(0, 300)));
