// diag: real browser login flow
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/auth') || (r.status() >= 400 && u.includes('/api/'))) {
      logs.push(`HTTP ${r.status()} ${r.request().method()} ${u.replace('http://localhost:3100', '')}`);
    }
  });

  await page.goto('http://localhost:3100/login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('#login-identifier', 'admin@example.com');
  await page.fill('#login-password', 'Pass1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);

  console.log('final url:', page.url());
  console.log('cookies:', (await page.context().cookies()).map((c) => `${c.name}=${c.value.slice(0, 8)}…`).join(', '));
  console.log('--- network/console ---');
  logs.slice(0, 25).forEach((l) => console.log(l));

  // does dashboard redirect back?
  await page.goto('http://localhost:3100/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('after direct /dashboard:', page.url());
  console.log('page has login form:', (await page.locator('#login-password').count()) > 0);

  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
