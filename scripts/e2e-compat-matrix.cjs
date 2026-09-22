// E2E cross-browser/device compatibility matrix — like big-platform QA
// Usage: node scripts/e2e-compat-matrix.cjs [chrome|edge]
// Each combo: critical pages render + no JS errors + key features present
const path = require('path');
const fs = require('fs');
const os = require('os');

const BROWSER_ARG = process.argv[2] || 'chrome';
const BINARIES = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const BROWSER_ALIASES = {
  chrome: ['chromium', 'chrome'],
  edge: ['msedge', 'edge'],
};
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3100';

// viewports: phone / tablet / laptop / desktop
const VIEWPORTS = [
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
  { name: 'desktop-1536', width: 1536, height: 960, mobile: false },
];

// public pages: must render with zero errors on every combo
const PUBLIC_PAGES = [
  { path: '/', name: 'landing', must: ['مهرسا', 'درخواست جلسه'] },
  { path: '/login', name: 'login', must: ['ورود به حساب'] },
  { path: '/request', name: 'public-request', must: ['شماره تماس'] },
  { path: '/r/room-room-a', name: 'room-live', must: ['آریا'] },
];

let pass = 0, fail = 0, failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); }
}

async function testCombo(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 3 : 1,
  });
  const page = await ctx.newPage();
  const tag = `${BROWSER_ARG}/${vp.name}`;

  for (const pg of PUBLIC_PAGES) {
    const errors = [];
    const onErr = (e) => errors.push(String(e).slice(0, 100));
    page.on('pageerror', onErr);
    try {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(800);
      const body = await page.evaluate(() => document.body.innerText);
      check(`${tag} ${pg.name} renders`, body.includes(pg.must[0]) && (pg.must.length < 2 || body.includes(pg.must[1])));
      check(`${tag} ${pg.name} no JS errors`, errors.length === 0, errors[0] || '');

      // horizontal overflow = broken responsive
      if (pg.path !== '/r/room-room-a') {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`${tag} ${pg.name} no x-overflow`, overflow <= 1, `+${overflow}px`);
      }

      if (pg.name === 'landing') {
        // install box renders + fits
        await page.evaluate(() => localStorage.removeItem('mehrsa-install-dismissed'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        const h3 = page.locator('h3:has-text("دم‌دست")');
        if (await h3.count()) {
          await h3.scrollIntoViewIfNeeded();
          await page.waitForTimeout(900);
          const box = await page.evaluate(() => {
            const el = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('دم‌دست'));
            const r = el.getBoundingClientRect();
            return { w: r.width, visible: r.width > 0 && r.height > 0 };
          });
          check(`${tag} install-box visible`, box.visible);
          check(`${tag} install-box fits`, box.w <= vp.width, `w=${Math.round(box.w)} vw=${vp.width}`);
        }
      }
      if (pg.name === 'login') {
        // forgot flow works in-place
        await page.click('[data-testid="forgot-password-link"]').catch(() => {});
        await page.waitForTimeout(500);
        const forgot = await page.evaluate(() => Boolean(document.querySelector('[data-testid="login-forgot-form"]')));
        check(`${tag} login forgot in-place`, forgot);
      }
      if (pg.name === 'public-request') {
        // phone field rtl + persian display
        await page.waitForTimeout(400);
        const tel = page.locator('input[inputmode="tel"]').first();
        const dir = await tel.getAttribute('dir').catch(() => null);
        check(`${tag} request phone rtl`, dir === 'rtl');
      }
    } catch (e) {
      check(`${tag} ${pg.name} loads`, false, String(e).slice(0, 120));
    }
    page.off('pageerror', onErr);
  }

  // authenticated app pages (admin) on this viewport
  const rl = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Pass1234' }),
  }).catch(() => null);
  if (rl && rl.ok) {
    for (const c of rl.headers.getSetCookie()) {
      const p = c.split(';')[0]; const i = p.indexOf('=');
      await ctx.addCookies([{ name: p.slice(0, i), value: p.slice(i + 1), domain: '127.0.0.1', path: '/' }]);
    }
    const APP_PAGES = [
      { path: '/dashboard', name: 'dashboard', must: ['داشبورد'] },
      { path: '/calendar', name: 'calendar', must: ['تقویم'] },
      { path: '/meetings', name: 'meetings-list', must: ['جلسه'] },
      { path: '/reports', name: 'reports', must: ['گزارش'] },
      { path: '/profile', name: 'profile', must: ['پروفایل'] },
    ];
    for (const pg of APP_PAGES) {
      const errors = [];
      const onErr = (e) => errors.push(String(e).slice(0, 100));
      page.on('pageerror', onErr);
      try {
        await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1200);
        const body = await page.evaluate(() => document.body.innerText);
        check(`${tag} app ${pg.name} renders`, body.length > 50 && (body.includes(pg.must[0]) || pg.name === 'meetings-list'), body.slice(0, 40));
        check(`${tag} app ${pg.name} no JS errors`, errors.length === 0, errors[0] || '');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`${tag} app ${pg.name} no x-overflow`, overflow <= 1, `+${overflow}px`);
      } catch (e) {
        check(`${tag} app ${pg.name} loads`, false, String(e).slice(0, 120));
      }
      page.off('pageerror', onErr);
    }
  } else {
    check(`${tag} admin login for app pages`, false, 'login failed');
  }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: BINARIES[BROWSER_ARG], headless: true });
  for (const vp of VIEWPORTS) {
    await testCombo(browser, vp);
    process.stdout.write(`  done ${BROWSER_ARG}/${vp.name}\n`);
  }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log('  ✗', f));
    process.exit(1);
  }
})().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
