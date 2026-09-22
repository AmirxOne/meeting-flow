// E2E: forgot-password flow runs INSIDE /login (same page, same layout)
const { chromium } = require('playwright');
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:3100';

let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}`); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const forgotLink = page.locator('[data-testid="forgot-password-link"]');
  check('login shows forgot-password link', await forgotLink.isVisible());

  // click → stays on /login, form swaps in place
  await forgotLink.click();
  await page.waitForTimeout(600);
  check('stays on /login', page.url().endsWith('/login'));
  check('forgot form appears in place', await page.locator('[data-testid="login-forgot-form"]').isVisible());
  check('back-to-login button shown', (await page.locator('button', { hasText: 'بازگشت به ورود' }).count()) > 0);

  // submit a real reset request
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/forgot-password') && r.request().method() === 'POST'),
    page.locator('[data-testid="login-forgot-form"] input').fill('ali@example.com'),
    page.locator('[data-testid="login-forgot-form"] button[type="submit"]').click(),
  ]);
  check('forgot-password API 200', res.status() === 200);

  await page.locator('[data-testid="login-forgot-sent"]').waitFor({ timeout: 10000 });
  check('success message shown in place', await page.locator('[data-testid="login-forgot-sent"]').isVisible());
  check('still on /login', page.url().endsWith('/login'));

  // back to login restores the password form
  await page.locator('button', { hasText: 'بازگشت به ورود' }).first().click();
  await page.waitForTimeout(500);
  check('login form restored', await page.locator('#login-identifier').isVisible());

  // legacy /forgot-password URL redirects into the same flow
  await page.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  check('legacy route redirects to /login', page.url().endsWith('/login'));

  console.log(`${pass}/${pass + fail} passed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', String(e).slice(0, 200)); process.exit(1); });
